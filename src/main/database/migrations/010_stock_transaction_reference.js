/**
 * 010 Stock Transaction Reference
 * Adds a free-text reference for supplier, return, incident, and count records.
 */

'use strict';

const MIGRATION_ID = '010_stock_transaction_reference';

async function up(db) {
  if (!await db.schema.hasColumn('stock_transactions', 'reference_text')) {
    await db.schema.alterTable('stock_transactions', (table) => {
      table.text('reference_text');
    });
  }
}

async function down(db) {
  if (await db.schema.hasColumn('stock_transactions', 'reference_text')) {
    await db.schema.alterTable('stock_transactions', (table) => {
      table.dropColumn('reference_text');
    });
  }
}

module.exports = { id: MIGRATION_ID, up, down };
