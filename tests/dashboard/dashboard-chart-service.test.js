/**
 * Dashboard Chart Service Test
 * Verifies timezone-aware calendar buckets and trusted line-chart sales totals.
 */

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const knex = require('knex');
const {
  buildChartPeriod,
  loadSalesChartData
} = require('../../src/main/services/dashboard-chart-service');

const TIMEZONE = 'Africa/Johannesburg';
const JUNE_13_NOW = new Date('2026-06-13T10:00:00.000Z');

test('weekly chart covers Monday through Sunday', () => {
  const period = buildChartPeriod('last7days', JUNE_13_NOW, TIMEZONE);

  assert.equal(period.startKey, '2026-06-08');
  assert.equal(period.endKey, '2026-06-14');
  assert.equal(period.dataEndKey, '2026-06-13');
  assert.deepEqual(
    period.buckets.map(bucket => bucket.label),
    ['Mon 8', 'Tue 9', 'Wed 10', 'Thu 11', 'Fri 12', 'Sat 13', 'Sun 14']
  );
});

test('month and year periods include their complete calendar ranges', () => {
  const month = buildChartPeriod('month', JUNE_13_NOW, TIMEZONE);
  const year = buildChartPeriod('year', JUNE_13_NOW, TIMEZONE);

  assert.equal(month.buckets.length, 30);
  assert.equal(month.buckets[0].label, '1');
  assert.equal(month.buckets.at(-1).key, '2026-06-30');
  assert.equal(month.buckets.at(-1).label, '30');
  assert.deepEqual(
    year.buckets.map(bucket => bucket.key),
    [
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'
    ]
  );
  assert.deepEqual(
    year.buckets.map(bucket => bucket.label),
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  );
});

test('monthly chart uses the correct number of days for each month', () => {
  const leapFebruary = buildChartPeriod(
    'month',
    new Date('2028-02-15T10:00:00.000Z'),
    TIMEZONE
  );
  const april = buildChartPeriod(
    'month',
    new Date('2026-04-15T10:00:00.000Z'),
    TIMEZONE
  );
  const july = buildChartPeriod(
    'month',
    new Date('2026-07-15T10:00:00.000Z'),
    TIMEZONE
  );

  assert.equal(leapFebruary.buckets.length, 29);
  assert.equal(april.buckets.length, 30);
  assert.equal(july.buckets.length, 31);
});

test('sales use the configured local date and future positions remain zero', async t => {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true
  });
  t.after(() => db.destroy());

  await db.schema.createTable('sales', table => {
    table.increments('id').primary();
    table.decimal('total_amount', 10, 2).notNullable();
    table.string('payment_status', 20).defaultTo('completed');
    table.string('status', 20).defaultTo('completed');
    table.text('created_at').notNullable();
  });
  await db('sales').insert([
    // This is June 13 at 00:30 in Johannesburg.
    { total_amount: 125, created_at: '2026-06-12T22:30:00.000Z' },
    { total_amount: 75, created_at: '2026-06-13 10:00:00' },
    // This becomes June 14 locally and must not appear while today is June 13.
    { total_amount: 999, created_at: '2026-06-13T22:30:00.000Z' }
  ]);

  const result = await loadSalesChartData(
    db,
    'last7days',
    JUNE_13_NOW,
    { timezone: TIMEZONE }
  );

  assert.equal(result.chartType, 'line');
  assert.equal(result.dates.at(-1), '2026-06-14');
  assert.equal(result.sales.at(-2), 200);
  assert.equal(result.sales.at(-1), 0);
  assert.equal(result.totalSales, 200);
});

test('dashboard chart reads the timezone saved in settings', async t => {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true
  });
  t.after(() => db.destroy());

  await db.schema.createTable('sales', table => {
    table.increments('id').primary();
    table.decimal('total_amount', 10, 2).notNullable();
    table.string('payment_status', 20).defaultTo('completed');
    table.string('status', 20).defaultTo('completed');
    table.text('created_at').notNullable();
  });
  await db.schema.createTable('settings', table => {
    table.text('key').primary();
    table.text('value');
  });
  await db('settings').insert({ key: 'timezone', value: TIMEZONE });
  await db('sales').insert({
    total_amount: 75,
    created_at: '2026-06-12T22:30:00.000Z'
  });

  const result = await loadSalesChartData(db, 'month', JUNE_13_NOW);

  assert.equal(result.dates.at(-1), '2026-06-30');
  assert.equal(result.sales[12], 75);
  assert.equal(result.sales.slice(13).every(value => value === 0), true);
});

test('category pie data allocates trusted sale totals across product categories', async t => {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true
  });
  t.after(() => db.destroy());

  await db.schema.createTable('sales', table => {
    table.increments('id').primary();
    table.decimal('total_amount', 10, 2).notNullable();
    table.string('payment_status', 20).defaultTo('completed');
    table.string('status', 20).defaultTo('completed');
    table.text('created_at').notNullable();
  });
  await db.schema.createTable('categories', table => {
    table.increments('id').primary();
    table.text('name').notNullable();
  });
  await db.schema.createTable('products', table => {
    table.increments('id').primary();
    table.integer('category_id');
  });
  await db.schema.createTable('sale_items', table => {
    table.increments('id').primary();
    table.integer('sale_id').notNullable();
    table.integer('product_id').notNullable();
    table.decimal('total_price', 10, 2).notNullable();
  });

  await db('categories').insert([
    { id: 1, name: 'Hardware' },
    { id: 2, name: 'Grocery' }
  ]);
  await db('products').insert([
    { id: 1, category_id: 1 },
    { id: 2, category_id: 2 },
    { id: 3, category_id: null }
  ]);
  await db('sales').insert([
    { id: 1, total_amount: 120, created_at: '2026-06-13T09:00:00.000Z' },
    { id: 2, total_amount: 50, created_at: '2026-06-13T10:00:00.000Z' },
    { id: 3, total_amount: 999, created_at: '2026-06-13T22:30:00.000Z' }
  ]);
  await db('sale_items').insert([
    { sale_id: 1, product_id: 1, total_price: 80 },
    { sale_id: 1, product_id: 2, total_price: 20 },
    { sale_id: 2, product_id: 3, total_price: 50 },
    { sale_id: 3, product_id: 1, total_price: 999 }
  ]);

  const result = await loadSalesChartData(
    db,
    'last7days',
    JUNE_13_NOW,
    { timezone: TIMEZONE }
  );

  assert.deepEqual(result.categorySales.labels, [
    'Hardware',
    'Uncategorized',
    'Grocery'
  ]);
  assert.deepEqual(result.categorySales.sales, [96, 50, 24]);
  assert.equal(result.categorySales.totalSales, 170);
  assert.equal(result.categorySales.colors.length, 3);
});
