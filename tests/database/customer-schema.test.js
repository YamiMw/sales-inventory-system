/**
 * Customer Schema Test
 * Verifies customer schema behavior and regression boundaries.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const knex = require('knex');

const {
  MIGRATIONS_TABLE,
  runPendingMigrations
} = require('../../src/main/database/migrations');
const {
  CUSTOMER_ENTITY_COLUMNS,
  verifyCustomerSchema
} = require('../../src/main/database/customer-schema');
const {
  createCustomerRecord,
  updateCustomerRecord
} = require('../../src/main/database/customer-persistence');

function createSqliteDatabase(filename) {
  return knex({
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true
  });
}

test('migration repairs a live-style customer table missing customer_type', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'db01-migration-'));
  const db = createSqliteDatabase(path.join(directory, 'legacy.db'));

  t.after(async () => {
    await db.destroy();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  await db.schema.createTable('customers', (table) => {
    table.increments('id').primary();
    table.string('customer_code', 50).unique();
    table.string('name', 200).notNullable();
    table.string('email', 200);
    table.string('phone', 50);
    table.string('mobile', 50);
    table.text('address');
    table.string('city', 100);
    table.string('state', 100);
    table.string('postal_code', 20);
    table.string('country', 100).defaultTo('USA');
    table.decimal('credit_limit', 10, 2).defaultTo(0);
    table.decimal('current_balance', 10, 2).defaultTo(0);
    table.string('status', 20).defaultTo('active');
    table.datetime('created_at').defaultTo(db.fn.now());
    table.datetime('updated_at').defaultTo(db.fn.now());
  });
  await db('customers').insert({
    customer_code: 'LEGACY-001',
    name: 'Legacy Customer'
  });
  await db.schema.createTable('sales', (table) => {
    table.increments('id').primary();
    table.string('invoice_number', 50).notNullable().unique();
  });

  const applied = await runPendingMigrations(db);
  assert.deepEqual(applied, [
    '001_initial_schema',
    '002_add_audit_logs',
    '003_add_quotations',
    '004_add_backorders',
    '005_add_permissions',
    '006_customer_schema_repair',
    '007_trusted_sale_calculation',
    '008_sale_item_cost_snapshot',
    '009_integrity_foundation',
    '010_stock_transaction_reference',
    '011_invoice_manager_approval',
    '012_quotation_manager_approval',
    '013_remove_customer_contact_location_fields'
  ]);

  const verification = await verifyCustomerSchema(db);
  assert.deepEqual(verification.missingColumns, []);
  assert.deepEqual(
    CUSTOMER_ENTITY_COLUMNS.filter((column) => !verification.columns.includes(column)),
    []
  );

  const customer = await db('customers').where('customer_code', 'LEGACY-001').first();
  assert.equal(customer.customer_type, 'Individual');
  for (const column of ['mobile', 'state', 'postal_code', 'country']) {
    assert.equal(Object.hasOwn(customer, column), false);
  }

  const secondRun = await runPendingMigrations(db);
  assert.deepEqual(secondRun, []);
  assert.equal(
    await db(MIGRATIONS_TABLE).where('id', '006_customer_schema_repair').count('* as count').first()
      .then((row) => Number(row.count)),
    1
  );
});

test('customer create and update use the verified fresh-database schema', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'db01-fresh-'));
  const databasePath = path.join(directory, 'fresh.db');
  const previousAppData = process.env.APPDATA;
  const previousDatabasePath = process.env.SALES_INVENTORY_DB_PATH;
  process.env.APPDATA = directory;
  process.env.SALES_INVENTORY_DB_PATH = databasePath;

  const connectionPath = require.resolve('../../src/main/database/connection');
  delete require.cache[connectionPath];
  const {
    closeDatabase,
    initializeDatabase
  } = require('../../src/main/database/connection');

  t.after(async () => {
    await closeDatabase();
    if (previousDatabasePath === undefined) {
      delete process.env.SALES_INVENTORY_DB_PATH;
    } else {
      process.env.SALES_INVENTORY_DB_PATH = previousDatabasePath;
    }
    if (previousAppData === undefined) {
      delete process.env.APPDATA;
    } else {
      process.env.APPDATA = previousAppData;
    }
    delete require.cache[connectionPath];
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const db = await initializeDatabase();
  const verification = await verifyCustomerSchema(db);
  assert.deepEqual(verification.missingColumns, []);

  const created = await createCustomerRecord(db, {
    name: 'Fresh Database Customer',
    email: 'fresh@example.com',
    phone: '0999000111',
    customerType: 'Business',
    creditLimit: 2500,
    status: 'Active'
  });

  let customer = await db('customers').where('id', created.id).first();
  assert.equal(customer.customer_type, 'Business');
  for (const column of ['mobile', 'state', 'postal_code', 'country']) {
    assert.equal(Object.hasOwn(customer, column), false);
  }
  assert.equal(Number(customer.credit_limit), 2500);

  const updated = await updateCustomerRecord(db, created.id, {
    name: 'Updated Fresh Customer',
    customerType: 'Individual',
    creditLimit: 0,
    city: 'Zomba'
  });

  assert.equal(updated, true);
  customer = await db('customers').where('id', created.id).first();
  assert.equal(customer.name, 'Updated Fresh Customer');
  assert.equal(customer.customer_type, 'Individual');
  assert.equal(Number(customer.credit_limit), 0);
  assert.equal(customer.city, 'Zomba');
  assert.equal(customer.email, 'fresh@example.com');
});
