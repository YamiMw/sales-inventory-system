/**
 * Path Resolver
 * Resolves writable database locations for development and packaged builds.
 */

const path = require('path');

const DATABASE_FILENAME = 'sales-inventory.db';
const DEFAULT_DATABASE_DIRECTORY = 'C:\\SalesInventoryData';

function getDatabasePath(options = {}) {
  if (process.env.SALES_INVENTORY_DB_PATH) {
    return path.resolve(process.env.SALES_INVENTORY_DB_PATH);
  }
  if (options.databasePath) {
    return path.resolve(options.databasePath);
  }
  return path.join(DEFAULT_DATABASE_DIRECTORY, DATABASE_FILENAME);
}

function getLegacyDatabasePath(app = null) {
  const appData = app && typeof app.getPath === 'function'
    ? app.getPath('userData')
    : process.env.APPDATA || process.env.HOME || DEFAULT_DATABASE_DIRECTORY;
  return path.join(appData, DATABASE_FILENAME);
}

module.exports = {
  DATABASE_FILENAME,
  DEFAULT_DATABASE_DIRECTORY,
  getDatabasePath,
  getLegacyDatabasePath
};
