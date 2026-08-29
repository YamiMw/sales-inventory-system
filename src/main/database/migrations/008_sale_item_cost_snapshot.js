/**
 * 008 Sale Item Cost Snapshot
 * Applies and rolls back migration 008 for sale item cost snapshot.
 */

const MIGRATION_ID = '008_sale_item_cost_snapshot';

async function up(db) {
  const hasSaleItems = await db.schema.hasTable('sale_items');
  if (!hasSaleItems) return;

  const hasUnitCost = await db.schema.hasColumn('sale_items', 'unit_cost');
  if (!hasUnitCost) {
    await db.schema.alterTable('sale_items', (table) => {
      table.decimal('unit_cost', 10, 2).nullable();
    });
  }
}

async function down(db) {
  const hasSaleItems = await db.schema.hasTable('sale_items');
  const hasUnitCost = hasSaleItems
    ? await db.schema.hasColumn('sale_items', 'unit_cost')
    : false;

  if (hasUnitCost) {
    await db.schema.alterTable('sale_items', (table) => {
      table.dropColumn('unit_cost');
    });
  }
}

module.exports = {
  id: MIGRATION_ID,
  up,
  down
};
