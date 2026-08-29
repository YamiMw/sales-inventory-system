/**
 * Authorized IPC Test
 * Verifies authorized ipc behavior and regression boundaries.
 */

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createAuthorizedIpc } = require('../../src/main/security/authorized-ipc');

function createFixture(overrides = {}) {
  const handlers = new Map();
  const audits = [];
  const user = {
    id: 7,
    username: 'operator',
    full_name: 'Test Operator',
    role: 'cashier',
    is_active: 1,
    status: 'active',
    permissions: '[]',
    password_must_change: 0,
    ...overrides.user
  };
  const db = table => ({
    where() {
      return {
        first: async () => table === 'users'
          ? user
          : { permissions: overrides.rolePermissions || '[]' }
      };
    }
  });
  const ipc = createAuthorizedIpc({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    authService: {
      validateToken: async token => token === 'valid-token'
        ? { userId: user.id, username: user.username, role: user.role }
        : null,
      invalidateUserSessions: async () => {}
    },
    getDatabase: () => db,
    auditService: { record: async entry => audits.push(entry) },
    logger: { error() {} }
  });
  return { ipc, handlers, audits };
}

test('channels without an explicit authorization policy cannot register', () => {
  const { ipc } = createFixture();
  assert.throws(() => ipc.handle('unreviewed:operation', async () => ({})), /policy/);
});

test('authenticated IPC reloads the user and injects the actual actor', async () => {
  const { ipc, handlers } = createFixture();
  ipc.handle('get-products', async event => ({ success: true, actor: event.auth }));
  const event = {};
  const result = await handlers.get('get-products')(
    event,
    { __authContext: true, token: 'valid-token' }
  );
  assert.equal(result.success, true);
  assert.equal(result.actor.userId, 7);
  assert.equal(result.actor.username, 'operator');
});

test('permission denial is returned before the business handler runs', async () => {
  const { ipc, handlers, audits } = createFixture();
  let called = false;
  ipc.handle('delete-product', async () => {
    called = true;
    return { success: true };
  });
  const result = await handlers.get('delete-product')(
    {},
    { __authContext: true, token: 'valid-token' }
  );
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(called, false);
  assert.equal(audits.at(-1).details.requiredPermission, 'delete_product');
});

test('forced password changes block normal business operations', async () => {
  const { ipc, handlers, audits } = createFixture({
    user: { password_must_change: 1 }
  });
  ipc.handle('get-products', async () => ({ success: true }));
  const result = await handlers.get('get-products')(
    {},
    { __authContext: true, token: 'valid-token' }
  );
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(audits.at(-1).details.reason, 'password_change_required');
});
