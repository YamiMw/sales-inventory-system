/**
 * Stock Adjustment Service Test
 * Verifies trusted operation derivation for inventory updates.
 */

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const knex = require('knex');
const {
  normalizeStockAdjustment
} = require('../../src/main/services/stock-adjustment-service');
const {
  applyStockDelta
} = require('../../src/main/services/stock-protection');

test('stock receipts and returns increase stock', () => {
  for (const type of ['receipt', 'return']) {
    const result = normalizeStockAdjustment({
      productId: 4,
      quantity: 7,
      type
    });
    assert.equal(result.operation, 'delta');
    assert.equal(result.delta, 7);
  }
});

test('damaged stock, lost stock and decrease corrections reduce stock', () => {
  const reductions = ['damage', 'lost'].map((type) => normalizeStockAdjustment({
    productId: 4,
    quantity: 3,
    type,
    stockChange: -3
  }));
  const correction = normalizeStockAdjustment({
    productId: 4,
    quantity: 2,
    type: 'adjustment',
    direction: 'decrease',
    stockChange: -2
  });

  assert.deepEqual(reductions.map(({ delta }) => delta), [-3, -3]);
  assert.equal(correction.delta, -2);
});

test('damaged, lost and manual decrease subtract from database stock', async t => {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true
  });
  t.after(() => db.destroy());

  await db.schema.createTable('products', table => {
    table.increments('id').primary();
    table.string('name');
    table.string('sku');
  });
  await db.schema.createTable('inventory', table => {
    table.integer('product_id').primary();
    table.integer('quantity_on_hand').notNullable();
    table.integer('quantity_reserved').notNullable().defaultTo(0);
    table.timestamp('updated_at');
  });
  await db('products').insert({ id: 4, name: 'Test Product', sku: 'TEST-4' });

  const adjustments = [
    { type: 'damage' },
    { type: 'lost' },
    { type: 'adjustment', direction: 'decrease' }
  ];

  for (const adjustment of adjustments) {
    await db('inventory')
      .insert({ product_id: 4, quantity_on_hand: 10, quantity_reserved: 0 })
      .onConflict('product_id')
      .merge({ quantity_on_hand: 10 });

    const normalized = normalizeStockAdjustment({
      productId: 4,
      quantity: 3,
      stockChange: -3,
      ...adjustment
    });
    const result = await applyStockDelta(db, {
      productId: 4,
      delta: normalized.delta,
      allowNegativeStock: false
    });

    assert.equal(result.beforeQuantity, 10);
    assert.equal(result.delta, -3);
    assert.equal(result.afterQuantity, 7);
  }
});

test('physical count sets the trusted target quantity', () => {
  const result = normalizeStockAdjustment({
    productId: 4,
    quantity: 12,
    type: 'count'
  });

  assert.equal(result.operation, 'set');
  assert.equal(result.targetQuantity, 12);
});

test('invalid quantities and correction directions are rejected', () => {
  assert.throws(
    () => normalizeStockAdjustment({ productId: 4, quantity: 0, type: 'receipt' }),
    /greater than zero/
  );
  assert.throws(
    () => normalizeStockAdjustment({
      productId: 4,
      quantity: 1,
      type: 'adjustment',
      direction: 'sideways'
    }),
    /Correction type/
  );
  assert.throws(
    () => normalizeStockAdjustment({
      productId: 4,
      quantity: 2,
      stockChange: 2,
      type: 'lost'
    }),
    /does not match/
  );
});
