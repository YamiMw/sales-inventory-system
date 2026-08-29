/**
 * Backup
 * Creates, validates, restores, and records database backup files.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const {
  initializeDatabase,
  getDatabase,
  getDatabasePath,
  closeDatabase
} = require('../database/connection');
const logger = require('./logger');

const BACKUP_PREFIX = 'sales-inventory-backup-';
const BACKUP_EXTENSION = '.db';

function getBackupDirectory() {
  if (process.env.SALES_INVENTORY_BACKUP_DIR) {
    return path.resolve(process.env.SALES_INVENTORY_BACKUP_DIR);
  }

  return path.join(path.dirname(getDatabasePath()), 'backups');
}

function createBackupFilename(date = new Date()) {
  const timestamp = date.toISOString()
    .replace(/[:.]/g, '-');
  return `${BACKUP_PREFIX}${timestamp}${BACKUP_EXTENSION}`;
}

async function removeExpiredBackups(backupDirectory, retentionDays, currentBackupPath) {
  const parsedDays = Number.parseInt(retentionDays, 10);
  if (!Number.isFinite(parsedDays) || parsedDays < 1) return [];

  const cutoff = Date.now() - parsedDays * 24 * 60 * 60 * 1000;
  const entries = await fs.promises.readdir(backupDirectory, { withFileTypes: true });
  const removed = [];

  for (const entry of entries) {
    if (
      !entry.isFile() ||
      !entry.name.startsWith(BACKUP_PREFIX) ||
      !entry.name.endsWith(BACKUP_EXTENSION)
    ) {
      continue;
    }

    const candidatePath = path.join(backupDirectory, entry.name);
    if (path.resolve(candidatePath) === path.resolve(currentBackupPath)) continue;

    const stats = await fs.promises.stat(candidatePath);
    if (stats.mtimeMs < cutoff) {
      await fs.promises.unlink(candidatePath);
      removed.push(candidatePath);
    }
  }

  return removed;
}

async function createDatabaseBackup(options = {}) {
  const sourcePath = getDatabasePath();
  const backupDirectory = getBackupDirectory();

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Database file not found: ${sourcePath}`);
  }

  await fs.promises.mkdir(backupDirectory, { recursive: true });

  const backupPath = path.join(backupDirectory, createBackupFilename());
  const db = getDatabase();

  try {
    // VACUUM INTO creates a transactionally consistent snapshot while the app stays open.
    await db.raw('VACUUM INTO ?', [backupPath]);

    const stats = await fs.promises.stat(backupPath);
    if (!stats.isFile() || stats.size === 0) {
      throw new Error('The backup file was created but contains no data');
    }

    const removedBackups = await removeExpiredBackups(
      backupDirectory,
      options.retentionDays,
      backupPath
    );

    logger.info(`Database backup created: ${backupPath}`);
    if (removedBackups.length) {
      logger.info(`Removed ${removedBackups.length} expired database backup(s)`);
    }

    return {
      filePath: backupPath,
      directory: backupDirectory,
      filename: path.basename(backupPath),
      size: stats.size,
      createdAt: stats.mtime.toISOString(),
      removedBackups: removedBackups.length
    };
  } catch (error) {
    if (fs.existsSync(backupPath)) {
      await fs.promises.unlink(backupPath).catch(() => {});
    }
    logger.error('Database backup failed:', error.message);
    throw error;
  }
}

function openReadOnlyDatabase(filePath) {
  return new Database(filePath, {
    readonly: true,
    fileMustExist: true
  });
}

function queryAll(database, sql) {
  return database.prepare(sql).all();
}

function closeSqliteDatabase(database) {
  database.close();
}

async function validateDatabaseBackup(filePath) {
  const resolvedPath = path.resolve(filePath);
  const stats = await fs.promises.stat(resolvedPath);
  if (!stats.isFile() || stats.size === 0) {
    throw new Error('The selected backup file is empty or invalid');
  }

  const database = await openReadOnlyDatabase(resolvedPath);
  try {
    const integrityRows = queryAll(database, 'PRAGMA quick_check');
    const integrityResult = integrityRows?.[0]?.quick_check;
    if (integrityResult !== 'ok') {
      throw new Error(`SQLite integrity check failed: ${integrityResult || 'unknown error'}`);
    }

    const tableRows = queryAll(
      database,
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    );
    const tables = new Set(tableRows.map(row => row.name));
    const requiredTables = ['users', 'products', 'inventory', 'settings'];
    const missingTables = requiredTables.filter(table => !tables.has(table));
    if (missingTables.length) {
      throw new Error(`This is not a valid Sales & Inventory backup. Missing: ${missingTables.join(', ')}`);
    }

    return {
      filePath: resolvedPath,
      size: stats.size,
      integrity: integrityResult
    };
  } finally {
    closeSqliteDatabase(database);
  }
}

async function restoreDatabaseBackup(filePath) {
  if (!filePath) {
    throw new Error('No backup file was selected');
  }

  const sourcePath = getDatabasePath();
  const selectedPath = path.resolve(filePath);
  if (selectedPath === path.resolve(sourcePath)) {
    throw new Error('Select a backup file, not the active database');
  }

  const validation = await validateDatabaseBackup(selectedPath);
  const safetyBackup = await createDatabaseBackup();
  const stagingPath = `${sourcePath}.restore-staging`;
  const rollbackPath = `${sourcePath}.restore-rollback`;
  let originalMoved = false;
  let restoreInstalled = false;

  await fs.promises.rm(stagingPath, { force: true });
  await fs.promises.rm(rollbackPath, { force: true });

  try {
    await closeDatabase();
    await fs.promises.copyFile(selectedPath, stagingPath);
    await fs.promises.rename(sourcePath, rollbackPath);
    originalMoved = true;
    await fs.promises.rename(stagingPath, sourcePath);
    restoreInstalled = true;

    await initializeDatabase();
    await fs.promises.rm(rollbackPath, { force: true });

    logger.info(`Database restored from: ${selectedPath}`);
    return {
      restoredFrom: selectedPath,
      databasePath: sourcePath,
      safetyBackupPath: safetyBackup.filePath,
      size: validation.size,
      restoredAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Database restore failed:', error.message);
    await closeDatabase().catch(() => {});

    if (restoreInstalled && fs.existsSync(sourcePath)) {
      await fs.promises.rm(sourcePath, { force: true });
    }
    if (originalMoved && fs.existsSync(rollbackPath)) {
      await fs.promises.rename(rollbackPath, sourcePath);
    }

    await initializeDatabase().catch(reopenError => {
      logger.error('Failed to reopen original database after restore rollback:', reopenError.message);
    });
    throw error;
  } finally {
    await fs.promises.rm(stagingPath, { force: true }).catch(() => {});
    if (!originalMoved) {
      await fs.promises.rm(rollbackPath, { force: true }).catch(() => {});
    }
  }
}

module.exports = {
  createDatabaseBackup,
  getBackupDirectory,
  restoreDatabaseBackup,
  validateDatabaseBackup
};
