/**
 * Database
 * Provides reusable database clocks and fixtures for integration tests.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const knex = require('knex');
const { runPendingMigrations } = require('../../src/main/database/migrations');

async function createTestDatabase(prefix = 'sales-inventory-test-') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const filename = path.join(directory, 'test.db');
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true
  });
  await runPendingMigrations(db);
  return {
    db,
    filename,
    async close() {
      await db.destroy();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  };
}

function createTestClock(iso = '2026-01-15T12:00:00.000Z') {
  const fixed = new Date(iso);
  return {
    now: () => new Date(fixed),
    today: () => fixed.toISOString().slice(0, 10)
  };
}

module.exports = { createTestClock, createTestDatabase };
