/**
 * Destructive Action Guard Test
 * Verifies destructive action guard behavior and regression boundaries.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DESTRUCTIVE_PERMISSIONS,
  createDestructiveActionGuard
} = require('../../src/main/security/destructive-action-guard');

function createGuardFixture(options = {}) {
  const audits = [];
  const session = options.session === undefined
    ? { userId: 2, username: 'manager', role: 'manager' }
    : options.session;
  const user = options.user === undefined
    ? {
        id: 2,
        username: 'manager',
        role: 'manager',
        is_active: 1,
        status: 'active',
        permissions: '[]'
      }
    : options.user;
  const rolePermissions = options.rolePermissions || '[]';

  const guard = createDestructiveActionGuard({
    logger: { error() {}, warn() {} },
    authService: {
      validateToken: async (token) => token === 'valid-token' ? session : null
    },
    getDatabase: () => ({}),
    loadUser: async () => user,
    loadRolePermissions: async () => ({ permissions: rolePermissions }),
    writeDeniedAudit: async (db, entry) => audits.push(entry)
  });

  return { guard, audits };
}

const request = {
  permission: DESTRUCTIVE_PERMISSIONS.CLEAR_DOCUMENT_HISTORY,
  action: 'clear_invoice_history',
  entityType: 'invoice'
};

test('missing session is denied and audited without a user id', async () => {
  const { guard, audits } = createGuardFixture();
  const result = await guard({ ...request, credentials: {} });

  assert.equal(result.authorized, false);
  assert.equal(result.response.code, 'AUTH_REQUIRED');
  assert.equal(audits.length, 1);
  assert.equal(audits[0].userId, null);
  assert.equal(audits[0].details.attemptedAction, 'clear_invoice_history');
  assert.equal(audits[0].details.denialReason, 'missing_or_invalid_session');
  assert.equal(JSON.stringify(audits[0]).includes('valid-token'), false);
});

test('active user without permission is denied and audited', async () => {
  const { guard, audits } = createGuardFixture();
  const result = await guard({
    ...request,
    credentials: { token: 'valid-token' }
  });

  assert.equal(result.authorized, false);
  assert.equal(result.response.code, 'FORBIDDEN');
  assert.equal(audits.length, 1);
  assert.equal(audits[0].userId, 2);
  assert.equal(audits[0].details.denialReason, 'permission_not_granted');
});

test('inactive user is denied even when the role has permission', async () => {
  const { guard, audits } = createGuardFixture({
    user: {
      id: 2,
      username: 'manager',
      role: 'manager',
      is_active: 0,
      status: 'inactive',
      permissions: '[]'
    },
    rolePermissions: JSON.stringify([
      DESTRUCTIVE_PERMISSIONS.CLEAR_DOCUMENT_HISTORY
    ])
  });
  const result = await guard({
    ...request,
    credentials: { token: 'valid-token' }
  });

  assert.equal(result.authorized, false);
  assert.equal(result.response.code, 'ACCOUNT_INACTIVE');
  assert.equal(audits[0].details.denialReason, 'account_missing_or_inactive');
});

test('explicit role permission authorizes a destructive action', async () => {
  const { guard, audits } = createGuardFixture({
    rolePermissions: JSON.stringify([
      DESTRUCTIVE_PERMISSIONS.CLEAR_DOCUMENT_HISTORY
    ])
  });
  const result = await guard({
    ...request,
    credentials: { token: 'valid-token' }
  });

  assert.equal(result.authorized, true);
  assert.equal(result.actor.userId, 2);
  assert.equal(audits.length, 0);
});

test('administrator role is authorized without an explicit permission row', async () => {
  const { guard, audits } = createGuardFixture({
    session: { userId: 1, username: 'admin', role: 'admin' },
    user: {
      id: 1,
      username: 'admin',
      role: 'admin',
      is_active: 1,
      status: 'active',
      permissions: null
    }
  });
  const result = await guard({
    ...request,
    credentials: { token: 'valid-token' }
  });

  assert.equal(result.authorized, true);
  assert.equal(result.actor.userId, 1);
  assert.equal(audits.length, 0);
});
