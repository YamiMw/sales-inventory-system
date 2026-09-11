/**
 * 013 Remove Customer Contact and Location Fields
 * Removes deprecated mobile, state, postal_code, and country columns.
 */

const MIGRATION_ID = '013_remove_customer_contact_location_fields';
const REMOVED_COLUMNS = ['mobile', 'state', 'postal_code', 'country'];

async function up(db) {
  if (!await db.schema.hasTable('customers')) return;

  const columnsToRemove = [];
  for (const column of REMOVED_COLUMNS) {
    if (await db.schema.hasColumn('customers', column)) {
      columnsToRemove.push(column);
    }
  }

  if (columnsToRemove.length > 0) {
    // Knex implements dropColumn by rebuilding the table on SQLite. That includes
    // dropping the original customers table, which fails when sales, quotations,
    // or invoices reference it and foreign keys are enabled. SQLite supports a
    // native DROP COLUMN, so use it to keep the referenced table in place.
    for (const column of columnsToRemove) {
      await db.raw(`ALTER TABLE "customers" DROP COLUMN "${column}"`);
    }
  }
}

async function down(db) {
  if (!await db.schema.hasTable('customers')) return;

  const existingColumns = await db('customers').columnInfo();
  await db.schema.alterTable('customers', (table) => {
    if (!existingColumns.mobile) table.string('mobile', 50);
    if (!existingColumns.state) table.string('state', 100);
    if (!existingColumns.postal_code) table.string('postal_code', 20);
    if (!existingColumns.country) table.string('country', 100).defaultTo('USA');
  });
}

module.exports = {
  id: MIGRATION_ID,
  up,
  down
};
