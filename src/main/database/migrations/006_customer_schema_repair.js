/**
 * 006 Customer Schema Repair
 * Applies and rolls back migration 006 for customer schema repair.
 */

const MIGRATION_ID = '006_customer_schema_repair';

async function up(db) {
  const hasCustomers = await db.schema.hasTable('customers');
  if (!hasCustomers) {
    throw new Error(`${MIGRATION_ID} cannot run because the customers table is missing`);
  }

  const hasCustomerType = await db.schema.hasColumn('customers', 'customer_type');
  if (!hasCustomerType) {
    await db.schema.alterTable('customers', (table) => {
      table.string('customer_type', 20).notNullable().defaultTo('Individual');
    });
  }

  await db('customers')
    .whereNull('customer_type')
    .orWhereRaw("TRIM(customer_type) = ''")
    .update({ customer_type: 'Individual' });
}

async function down(db) {
  const hasCustomers = await db.schema.hasTable('customers');
  const hasCustomerType = hasCustomers
    ? await db.schema.hasColumn('customers', 'customer_type')
    : false;

  if (hasCustomerType) {
    await db.schema.alterTable('customers', (table) => {
      table.dropColumn('customer_type');
    });
  }
}

module.exports = {
  id: MIGRATION_ID,
  up,
  down
};
