/**
 * Audit Service Test
 * Verifies audit service behavior and regression boundaries.
 */

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const auditService = require('../../src/main/services/audit-service');
const { createTestDatabase } = require('../fixtures/database');

test('audit entries retain the authenticated actor and are queryable', async t => {
  const fixture = await createTestDatabase('audit-service-');
  t.after(() => fixture.close());
  const [userId] = await fixture.db('users').insert({
    username: 'auditor',
    password_hash: 'not-used',
    full_name: 'Audit User',
    role: 'admin',
    status: 'active',
    is_active: true
  });

  await auditService.record({
    action: 'system:update-settings',
    entityType: 'system',
    userId,
    details: { success: true }
  }, fixture.db);

  const rows = await auditService.query({ userId, limit: 10 }, fixture.db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, userId);
  assert.equal(rows[0].username, 'auditor');
  assert.equal(JSON.parse(rows[0].new_values).success, true);
});
