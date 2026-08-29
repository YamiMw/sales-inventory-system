/**
 * Destructive Document Handlers Test
 * Verifies destructive document handlers behavior and regression boundaries.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const knex = require('knex');

const {
  createDestructiveActionGuard
} = require('../../src/main/security/destructive-action-guard');
const {
  registerDestructiveDocumentHandlers
} = require('../../src/main/ipc/destructive-document-handlers');

function createIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, handler) {
      handlers.set(channel, handler);
    }
  };
}

function quietLogger() {
  return {
    error() {},
    warn() {}
  };
}

test('direct unauthorized calls to all destructive channels fail and write SQLite audit rows', async (t) => {
  const ipcMain = createIpcMain();
  const databasePath = path.join(__dirname, 'sec-01-audit-test.db');
  fs.rmSync(databasePath, { force: true });
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: databasePath },
    useNullAsDefault: true
  });
  t.after(async () => {
    await db.destroy();
    fs.rmSync(databasePath, { force: true });
  });

  await db.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id');
    table.string('action', 50).notNullable();
    table.string('entity_type', 50).notNullable();
    table.integer('entity_id');
    table.text('old_values');
    table.text('new_values');
    table.string('ip_address', 50);
    table.datetime('created_at');
  });

  const guard = createDestructiveActionGuard({
    logger: quietLogger(),
    authService: { validateToken: async () => null },
    getDatabase: () => db,
    loadUser: async () => null,
    loadRolePermissions: async () => null
  });

  registerDestructiveDocumentHandlers({
    ipcMain,
    getDatabase: () => db,
    authorizeDestructiveAction: guard,
    recordAuditLog: async () => {},
    logger: quietLogger()
  });

  const calls = [
    ['delete-quotation', [55, {}]],
    ['clear-quotations', [{}]],
    ['clear-invoices', [{}]]
  ];

  for (const [channel, args] of calls) {
    const result = await ipcMain.handlers.get(channel)({}, ...args);
    assert.equal(result.success, false);
    assert.equal(result.code, 'AUTH_REQUIRED');
  }

  const audits = await db('audit_logs')
    .where('action', 'authorization_denied')
    .orderBy('id');
  assert.equal(audits.length, 3);
  assert.deepEqual(
    audits.map(entry => JSON.parse(entry.new_values).attemptedAction),
    ['delete_quotation', 'clear_quotation_history', 'clear_invoice_history']
  );
  assert.equal(
    audits.some(entry => String(entry.new_values).includes('token')),
    false
  );
});

test('authorized request still requires an operator reason before mutation', async () => {
  const ipcMain = createIpcMain();
  let transactionCalls = 0;
  const db = {
    transaction: async () => {
      transactionCalls += 1;
    }
  };

  registerDestructiveDocumentHandlers({
    ipcMain,
    getDatabase: () => db,
    authorizeDestructiveAction: async () => ({
      authorized: true,
      actor: { userId: 1, username: 'admin', role: 'admin' }
    }),
    recordAuditLog: async () => {},
    logger: quietLogger()
  });

  const result = await ipcMain.handlers.get('clear-invoices')(
    {},
    { token: 'valid-token', reason: ' ' }
  );

  assert.equal(result.success, false);
  assert.equal(result.code, 'REASON_REQUIRED');
  assert.equal(transactionCalls, 0);
});

test('authorized invoice clear records the authenticated actor', async () => {
  const ipcMain = createIpcMain();
  const deletedTables = [];
  const auditEntries = [];

  function trx(table) {
    return {
      count() {
        return {
          first: async () => ({ count: 2 })
        };
      },
      async delete() {
        deletedTables.push(table);
      }
    };
  }

  const db = {
    transaction: async (callback) => callback(trx)
  };

  registerDestructiveDocumentHandlers({
    ipcMain,
    getDatabase: () => db,
    authorizeDestructiveAction: async () => ({
      authorized: true,
      actor: { userId: 1, username: 'admin', role: 'admin' }
    }),
    recordAuditLog: async (transaction, entry) => auditEntries.push(entry),
    logger: quietLogger()
  });

  const result = await ipcMain.handlers.get('clear-invoices')(
    {},
    { token: 'valid-token', reason: 'Approved test cleanup' }
  );

  assert.equal(result.success, true);
  assert.equal(result.data.cleared, 2);
  assert.deepEqual(deletedTables, ['payments', 'invoice_items', 'invoices']);
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].userId, 1);
  assert.equal(auditEntries[0].newValues.reason, 'Approved test cleanup');
  assert.equal(auditEntries[0].newValues.authorizedBy, 'admin');
});
