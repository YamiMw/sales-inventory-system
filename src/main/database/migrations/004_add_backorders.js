/**
 * 004 Add Backorders
 * Applies and rolls back migration 004 for add backorders.
 */

const MIGRATION_ID = '004_add_backorders';

async function up(db) {
  if (await db.schema.hasTable('backorders')) return;
  await db.schema.createTable('backorders', (table) => {
    table.increments('id').primary();
    table.string('backorder_number', 50).notNullable().unique();
    table.integer('product_id').notNullable().references('id').inTable('products');
    table.integer('quantity').notNullable();
    table.integer('quotation_id').references('id').inTable('quotations');
    table.integer('invoice_id').references('id').inTable('invoices');
    table.string('status', 20).notNullable().defaultTo('pending');
    table.date('expected_date');
    table.datetime('fulfilled_at');
    table.text('notes');
    table.datetime('created_at').notNullable().defaultTo(db.fn.now());
    table.datetime('updated_at').notNullable().defaultTo(db.fn.now());
  });
}

async function down(db) {
  await db.schema.dropTableIfExists('backorders');
}

module.exports = { id: MIGRATION_ID, up, down };
