/**
 * Verify Trusted Sale
 * Exercises trusted sale calculations against a temporary database.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const knex = require('knex');

const {
  runPendingMigrations
} = require('../src/main/database/migrations');
const {
  createTrustedSale,
  reproducePersistedSaleTotals
} = require('../src/main/services/trusted-sale-service');

const databasePath = path.resolve(
  process.argv[2]
    || process.env.SALES_INVENTORY_DB_PATH
    || 'C:\\SalesInventoryData\\sales-inventory.db'
);
const REQUIRED_SALES_COLUMNS = [
  'discount_rate',
  'tax_rate',
  'tax_inclusive',
  'tax_exempt'
];

function integrityValue(rows) {
  return rows?.[0]?.integrity_check || null;
}

async function getRecordCounts(db) {
  const [sales, saleItems, stockTransactions] = await Promise.all([
    db('sales').count('* as count').first(),
    db('sale_items').count('* as count').first(),
    db('stock_transactions').count('* as count').first()
  ]);
  return {
    sales: Number(sales.count),
    saleItems: Number(saleItems.count),
    stockTransactions: Number(stockTransactions.count)
  };
}

async function main() {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: databasePath },
    useNullAsDefault: true
  });

  try {
    const integrityBefore = integrityValue(await db.raw('PRAGMA integrity_check'));
    assert.equal(integrityBefore, 'ok');

    const appliedMigrations = await runPendingMigrations(db);
    const salesColumns = Object.keys(await db('sales').columnInfo());
    const missingColumns = REQUIRED_SALES_COLUMNS.filter(
      (column) => !salesColumns.includes(column)
    );
    assert.deepEqual(missingColumns, []);

    const product = await db('products')
      .select(
        'products.id',
        'products.unit_price',
        'inventory.quantity_on_hand'
      )
      .join('inventory', 'inventory.product_id', 'products.id')
      .where('products.is_active', true)
      .where('inventory.quantity_on_hand', '>', 0)
      .orderBy('products.id')
      .first();
    assert.ok(product, 'A stocked active product is required for the sale rehearsal');

    const countsBefore = await getRecordCounts(db);
    const stockBefore = Number(product.quantity_on_hand);
    const trx = await db.transaction();
    let rehearsal;

    try {
      const result = await createTrustedSale(trx, {
        items: [{
          productId: product.id,
          quantity: 1,
          price: 0.01
        }],
        subtotal: 0.01,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 0.01,
        discountRate: 0,
        payments: [{ method: 'cash', amount: 1000000000 }],
        notes: 'POS-01 rolled-back verification'
      });

      const sale = await trx('sales').where('id', result.saleId).first();
      const items = await trx('sale_items').where('sale_id', result.saleId);
      const reproduced = reproducePersistedSaleTotals(sale, items);
      assert.equal(result.rendererPricingOverridden, true);
      assert.equal(Number(items[0].unit_price), Number(product.unit_price));
      assert.deepEqual(reproduced, {
        subtotal: Number(sale.subtotal),
        discountAmount: Number(sale.discount_amount),
        taxAmount: Number(sale.tax_amount),
        totalAmount: Number(sale.total_amount)
      });

      rehearsal = {
        invoiceNumber: result.invoiceNumber,
        databaseUnitPrice: Number(items[0].unit_price),
        trustedTotal: result.totalAmount,
        reproduced,
        rendererPricingOverridden: result.rendererPricingOverridden
      };
      await trx.rollback();
    } catch (error) {
      await trx.rollback().catch(() => {});
      throw error;
    }

    const countsAfter = await getRecordCounts(db);
    const inventoryAfter = await db('inventory')
      .where('product_id', product.id)
      .first();
    assert.deepEqual(countsAfter, countsBefore);
    assert.equal(Number(inventoryAfter.quantity_on_hand), stockBefore);

    const integrityAfter = integrityValue(await db.raw('PRAGMA integrity_check'));
    assert.equal(integrityAfter, 'ok');

    process.stdout.write(`${JSON.stringify({
      databasePath,
      appliedMigrations,
      integrityBefore,
      integrityAfter,
      salesColumns,
      countsBefore,
      countsAfter,
      stockBefore,
      stockAfter: Number(inventoryAfter.quantity_on_hand),
      rehearsal
    }, null, 2)}\n`);
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
