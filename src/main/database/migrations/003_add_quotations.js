/**
 * 003 Add Quotations
 * Applies and rolls back migration 003 for add quotations.
 */

const MIGRATION_ID = '003_add_quotations';

async function up(db) {
  if (!await db.schema.hasTable('quotations')) {
    throw new Error('Initial schema is incomplete: quotations table is missing');
  }
}

async function down() {}

module.exports = { id: MIGRATION_ID, up, down };
