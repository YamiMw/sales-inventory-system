/**
 * Connection
 * Owns the SQLite connection lifecycle and database initialization sequence.
 */

const path = require('path');
const knex = require('knex');
const fs = require('fs');
const logger = require('../utils/logger');
const { runPendingMigrations } = require('./migrations');
const { verifyCustomerSchema } = require('./customer-schema');
const invoiceManagerApproval = require('./migrations/011_invoice_manager_approval');
const {
  getDatabasePath: resolveDatabasePath,
  getLegacyDatabasePath
} = require('./path-resolver');

let db = null;

const CONFIGURED_DATABASE_PATH = resolveDatabasePath();

const getElectronApp = () => {
  try {
    return require('electron').app;
  } catch {
    return null;
  }
};

const ensureFixedDatabasePath = () => {
  const databaseDirectory = path.dirname(CONFIGURED_DATABASE_PATH);
  if (!fs.existsSync(databaseDirectory)) {
    fs.mkdirSync(databaseDirectory, { recursive: true });
  }

  const legacyPath = process.env.SALES_INVENTORY_DB_PATH
    ? null
    : getLegacyDatabasePath(getElectronApp());
  // Migrate an existing user database only when the fixed destination is still empty.
  if (
    !process.env.SALES_INVENTORY_DB_PATH &&
    legacyPath &&
    path.resolve(legacyPath) !== path.resolve(CONFIGURED_DATABASE_PATH) &&
    fs.existsSync(legacyPath) &&
    !fs.existsSync(CONFIGURED_DATABASE_PATH)
  ) {
    fs.copyFileSync(legacyPath, CONFIGURED_DATABASE_PATH);
    logger.info(`Copied existing database from ${legacyPath} to ${CONFIGURED_DATABASE_PATH}`);
  }
};

// Get database path
const getDatabasePath = () => {
  ensureFixedDatabasePath();
  return CONFIGURED_DATABASE_PATH;
};

const getDbConfig = () => ({
  client: 'better-sqlite3',
  connection: {
    filename: getDatabasePath()
  },
  useNullAsDefault: true,
  pool: {
    min: 1,
    max: 1,
    afterCreate: (conn, done) => {
      try {
        conn.pragma('foreign_keys = ON');
        conn.pragma('busy_timeout = 5000');
        conn.pragma('journal_mode = WAL');
        done(null, conn);
      } catch (error) {
        logger.error('Failed to configure SQLite connection:', error);
        done(error, conn);
      }
    }
  }
});

async function initializeDatabase() {
  try {
    logger.info('Connecting to database at:', getDatabasePath());
    
    db = knex(getDbConfig());
    
    // Test connection
    await db.raw('SELECT 1');
    logger.info('Database connection established');
    
    // Verify both migration completion and the schema required by customer workflows.
    await runPendingMigrations(db, { logger });
    await invoiceManagerApproval.up(db);
    logger.info('Invoice approval schema verified');
    const customerSchema = await verifyCustomerSchema(db);
    logger.info(
      `Customer schema verified (${customerSchema.columns.length} columns)`
    );
    
    return db;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

async function closeDatabase() {
  if (db) {
    await db.destroy();
    db = null;
    logger.info('Database connection closed');
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  getDatabasePath,
  closeDatabase
};

