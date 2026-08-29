/**
 * Migrations
 * Discovers and applies application database migrations in order.
 */

const initialSchema = require('./migrations/001_initial_schema');
const addAuditLogs = require('./migrations/002_add_audit_logs');
const addQuotations = require('./migrations/003_add_quotations');
const addBackorders = require('./migrations/004_add_backorders');
const addPermissions = require('./migrations/005_add_permissions');
const customerSchemaRepair = require('./migrations/006_customer_schema_repair');
const trustedSaleCalculation = require('./migrations/007_trusted_sale_calculation');
const saleItemCostSnapshot = require('./migrations/008_sale_item_cost_snapshot');
const integrityFoundation = require('./migrations/009_integrity_foundation');
const stockTransactionReference = require('./migrations/010_stock_transaction_reference');
const invoiceManagerApproval = require('./migrations/011_invoice_manager_approval');
const quotationManagerApproval = require('./migrations/012_quotation_manager_approval');

const MIGRATIONS_TABLE = '_app_migrations';
const migrations = Object.freeze([
  initialSchema,
  addAuditLogs,
  addQuotations,
  addBackorders,
  addPermissions,
  customerSchemaRepair,
  trustedSaleCalculation,
  saleItemCostSnapshot,
  integrityFoundation,
  stockTransactionReference,
  invoiceManagerApproval,
  quotationManagerApproval
]);

async function ensureMigrationsTable(db) {
  const exists = await db.schema.hasTable(MIGRATIONS_TABLE);
  if (exists) return;

  await db.schema.createTable(MIGRATIONS_TABLE, (table) => {
    table.string('id', 100).primary();
    table.datetime('applied_at').notNullable().defaultTo(db.fn.now());
  });
}

async function runPendingMigrations(db, options = {}) {
  const logger = options.logger || { info() {} };
  await ensureMigrationsTable(db);

  const appliedRows = await db(MIGRATIONS_TABLE).select('id');
  const appliedIds = new Set(appliedRows.map((row) => row.id));
  const applied = [];

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;

    try {
      await db.transaction(async (trx) => {
        await migration.up(trx);
        await trx(MIGRATIONS_TABLE).insert({
          id: migration.id,
          applied_at: trx.fn.now()
        });
      });
    } catch (error) {
      if (typeof logger.error === 'function') {
        logger.error(`Failed database migration ${migration.id}:`, error.message);
      }
      throw error;
    }

    logger.info(`Applied database migration ${migration.id}`);
    applied.push(migration.id);
  }

  return applied;
}

module.exports = {
  MIGRATIONS_TABLE,
  migrations,
  runPendingMigrations
};

