/**
 * Repair Customer Schema
 * Runs the compatibility repair for customer database columns.
 */

const assert = require('node:assert/strict');
const knex = require('knex');
const { getDatabasePath } = require('../src/main/database/path-resolver');

const {
  runPendingMigrations
} = require('../src/main/database/migrations');
const {
  verifyCustomerSchema
} = require('../src/main/database/customer-schema');
const {
  createCustomerRecord,
  updateCustomerRecord
} = require('../src/main/database/customer-persistence');

const databasePath = process.argv[2] || getDatabasePath();

function getIntegrityResult(rawResult) {
  const rows = Array.isArray(rawResult) ? rawResult : [];
  const firstRow = rows[0] || {};
  return firstRow.integrity_check || firstRow.quick_check || null;
}

async function rehearseCustomerCrud(db) {
  const transaction = await db.transaction();

  try {
    const marker = `DB01-${Date.now()}`;
    const created = await createCustomerRecord(transaction, {
      customerCode: marker,
      name: 'DB-01 Restore Rehearsal',
      customerType: 'Business',
      creditLimit: 1250,
      status: 'Active'
    });

    const updated = await updateCustomerRecord(transaction, created.id, {
      name: 'DB-01 Updated Rehearsal',
      customerType: 'Individual',
      creditLimit: 0
    });
    assert.equal(updated, true);

    const customer = await transaction('customers').where('id', created.id).first();
    assert.equal(customer.name, 'DB-01 Updated Rehearsal');
    assert.equal(customer.customer_type, 'Individual');
    assert.equal(Number(customer.credit_limit), 0);

    await transaction.rollback();
    return {
      created: true,
      updated: true,
      rolledBack: true
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function main() {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: databasePath },
    useNullAsDefault: true
  });

  try {
    const integrityBefore = getIntegrityResult(await db.raw('PRAGMA integrity_check'));
    assert.equal(integrityBefore, 'ok', 'SQLite integrity check failed before migration');

    const appliedMigrations = await runPendingMigrations(db);
    const schema = await verifyCustomerSchema(db);
    const customerCountBefore = await db('customers').count('* as count').first();
    const crudRehearsal = await rehearseCustomerCrud(db);
    const customerCountAfter = await db('customers').count('* as count').first();
    assert.equal(
      Number(customerCountAfter.count),
      Number(customerCountBefore.count),
      'Customer CRUD rehearsal changed the live record count'
    );

    const integrityAfter = getIntegrityResult(await db.raw('PRAGMA integrity_check'));
    assert.equal(integrityAfter, 'ok', 'SQLite integrity check failed after migration');

    process.stdout.write(`${JSON.stringify({
      databasePath,
      appliedMigrations,
      integrityBefore,
      integrityAfter,
      customerColumnCount: schema.columns.length,
      customerColumns: schema.columns,
      customerCountBefore: Number(customerCountBefore.count),
      customerCountAfter: Number(customerCountAfter.count),
      crudRehearsal
    }, null, 2)}\n`);
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
