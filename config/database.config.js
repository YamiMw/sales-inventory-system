/**
 * Database Config
 * Configures Knex to use the application SQLite database and migration directory.
 */

'use strict';

const { getDatabasePath } = require('../src/main/database/path-resolver');

module.exports = {
  client: 'better-sqlite3',
  connection: {
    filename: getDatabasePath()
  },
  useNullAsDefault: true,
  migrations: {
    directory: './src/main/database/migrations',
    tableName: '_app_migrations'
  }
};
