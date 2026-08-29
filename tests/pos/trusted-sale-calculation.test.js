/**
 * Trusted Sale Calculation Test
 * Verifies trusted sale calculation behavior and regression boundaries.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const knex = require('knex');

const {
  createTrustedSale,
  reproducePersistedSaleTotals
} = require('../../src/main/services/trusted-sale-service');
const { createTestClock } = require('../fixtures/database');

async function createFixture(t, settings = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pos01-'));
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: path.join(directory, 'pos.db') },
    useNullAsDefault: true
  });

  t.after(async () => {
    await db.destroy();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  await db.schema.createTable('settings', (table) => {
    table.string('key', 100).primary();
    table.text('value');
  });
  await db.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.string('sku', 50).notNullable().unique();
    table.string('name', 200).notNullable();
    table.decimal('unit_price', 10, 2).notNullable();
    table.decimal('cost_price', 10, 2);
    table.boolean('is_active').notNullable().defaultTo(true);
  });
  await db.schema.createTable('inventory', (table) => {
    table.increments('id').primary();
    table.integer('product_id').notNullable().unique();
    table.integer('quantity_on_hand').notNullable().defaultTo(0);
    table.datetime('updated_at');
  });
  await db.schema.createTable('sales', (table) => {
    table.increments('id').primary();
    table.string('invoice_number', 50).notNullable().unique();
    table.integer('customer_id');
    table.decimal('subtotal', 10, 2).notNullable();
    table.decimal('discount_rate', 7, 6).notNullable().defaultTo(0);
    table.decimal('discount_amount', 10, 2).notNullable().defaultTo(0);
    table.decimal('tax_rate', 7, 4).notNullable().defaultTo(0);
    table.boolean('tax_inclusive').notNullable().defaultTo(false);
    table.boolean('tax_exempt').notNullable().defaultTo(false);
    table.decimal('tax_amount', 10, 2).notNullable().defaultTo(0);
    table.decimal('total_amount', 10, 2).notNullable();
    table.string('payment_method', 50);
    table.string('payment_status', 20);
    table.text('notes');
    table.integer('created_by');
    table.datetime('created_at');
  });
  await db.schema.createTable('sale_items', (table) => {
    table.increments('id').primary();
    table.integer('sale_id').notNullable();
    table.integer('product_id').notNullable();
    table.integer('quantity').notNullable();
    table.decimal('unit_price', 10, 2).notNullable();
    table.decimal('unit_cost', 10, 2);
    table.decimal('discount_percent', 5, 2).notNullable().defaultTo(0);
    table.decimal('total_price', 10, 2).notNullable();
  });
  await db.schema.createTable('stock_transactions', (table) => {
    table.increments('id').primary();
    table.integer('product_id').notNullable();
    table.string('transaction_type', 50).notNullable();
    table.integer('quantity').notNullable();
    table.integer('quantity_before');
    table.integer('quantity_after');
    table.string('reference_type', 50);
    table.integer('reference_id');
    table.text('notes');
    table.integer('created_by');
    table.datetime('created_at');
  });

  await db('settings').insert([
    {
      key: 'default_tax_rate',
      value: String(settings.defaultTaxRate ?? 17.5)
    },
    {
      key: 'tax_inclusive',
      value: String(settings.taxInclusive ?? false)
    }
  ]);

  return db;
}

async function addProduct(db, product = {}) {
  const [id] = await db('products').insert({
    sku: product.sku || `SKU-${Date.now()}`,
    name: product.name || 'Trusted Product',
    unit_price: product.unitPrice ?? 1000,
    cost_price: product.costPrice ?? null,
    is_active: product.isActive ?? true
  });
  await db('inventory').insert({
    product_id: id,
    quantity_on_hand: product.stock ?? 10
  });
  return id;
}

test('forged renderer prices and totals are ignored in favor of database values', async (t) => {
  const db = await createFixture(t);
  const productId = await addProduct(db, {
    unitPrice: 1000,
    costPrice: 600,
    stock: 10
  });

  const result = await createTrustedSale(db, {
    items: [{
      productId,
      quantity: 2,
      price: 0.01,
      unitPrice: 0.01,
      totalPrice: 0.02
    }],
    discountRate: 0.10,
    subtotal: 0.02,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 0.02,
    payments: [{ method: 'cash', amount: 3000 }]
  });

  assert.equal(result.rendererPricingOverridden, true);
  assert.equal(result.subtotal, 2000);
  assert.equal(result.discountAmount, 200);
  assert.equal(result.taxAmount, 315);
  assert.equal(result.totalAmount, 1800);

  const sale = await db('sales').where('id', result.saleId).first();
  const items = await db('sale_items').where('sale_id', result.saleId);
  const inventory = await db('inventory').where('product_id', productId).first();

  assert.equal(Number(sale.subtotal), 2000);
  assert.equal(Number(sale.discount_rate), 0.10);
  assert.equal(Number(sale.discount_amount), 200);
  assert.equal(Number(sale.tax_rate), 17.5);
  assert.equal(Number(sale.tax_amount), 315);
  assert.equal(Number(sale.total_amount), 1800);
  assert.equal(Number(items[0].unit_price), 1000);
  assert.equal(Number(items[0].unit_cost), 600);
  assert.equal(Number(items[0].discount_percent), 10);
  assert.equal(Number(items[0].total_price), 1800);
  assert.equal(inventory.quantity_on_hand, 8);

  await db('settings')
    .where('key', 'default_tax_rate')
    .update({ value: '50' });

  assert.deepEqual(reproducePersistedSaleTotals(sale, items), {
    subtotal: 2000,
    discountAmount: 200,
    taxAmount: 315,
    totalAmount: 1800
  });
});

test('tax-inclusive settings extract tax without adding it to the final total', async (t) => {
  const db = await createFixture(t, {
    defaultTaxRate: 17.5,
    taxInclusive: true
  });
  const productId = await addProduct(db, { unitPrice: 117.50 });

  const result = await createTrustedSale(db, {
    items: [{ productId, quantity: 2 }],
    discountRate: 0,
    taxExempt: false,
    payments: [{ method: 'card', amount: 235 }]
  });

  assert.equal(result.subtotal, 235);
  assert.equal(result.discountAmount, 0);
  assert.equal(result.taxAmount, 35);
  assert.equal(result.totalAmount, 235);

  const sale = await db('sales').where('id', result.saleId).first();
  assert.equal(Number(sale.tax_inclusive), 1);
  assert.equal(Number(sale.tax_rate), 17.5);
});

test('underpayment is checked against the trusted total and rolls back the sale', async (t) => {
  const db = await createFixture(t, { defaultTaxRate: 0 });
  const productId = await addProduct(db, { unitPrice: 100, stock: 4 });

  await assert.rejects(
    createTrustedSale(db, {
      items: [{ productId, quantity: 2, price: 0.01 }],
      discountRate: 0,
      totalAmount: 0.02,
      payments: [{ method: 'cash', amount: 0.02 }]
    }),
    /trusted sale total of 200\.00/
  );

  const saleCount = await db('sales').count('* as count').first();
  const inventory = await db('inventory').where('product_id', productId).first();
  const transactionCount = await db('stock_transactions').count('* as count').first();
  assert.equal(Number(saleCount.count), 0);
  assert.equal(inventory.quantity_on_hand, 4);
  assert.equal(Number(transactionCount.count), 0);
});

test('discount rates outside the POS policy are rejected', async (t) => {
  const db = await createFixture(t);
  const productId = await addProduct(db);

  await assert.rejects(
    createTrustedSale(db, {
      items: [{ productId, quantity: 1 }],
      discountRate: 0.99,
      payments: [{ method: 'cash', amount: 5000 }]
    }),
    /0%, 2%, 5%, or 10%/
  );

  assert.equal(
    Number((await db('sales').count('* as count').first()).count),
    0
  );
});

test('financial identifiers and timestamps use the injected deterministic clock', async t => {
  const db = await createFixture(t, { defaultTaxRate: 0 });
  const productId = await addProduct(db, { unitPrice: 25, stock: 2 });
  const clock = createTestClock('2031-04-05T06:07:08.000Z');

  const result = await createTrustedSale(db, {
    items: [{ productId, quantity: 1 }],
    discountRate: 0,
    payments: [{ method: 'cash', amount: 25 }]
  }, { clock });

  assert.match(result.invoiceNumber, /^POS-2031-/);
  assert.equal(result.createdAt, '2031-04-05T06:07:08.000Z');
  const sale = await db('sales').where('id', result.saleId).first();
  assert.equal(new Date(sale.created_at).toISOString(), result.createdAt);
});
