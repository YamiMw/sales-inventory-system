/**
 * Honest Reporting Test
 * Verifies honest reporting behavior and regression boundaries.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const knex = require('knex');

const ReportsView = require('../../src/renderer/js/views/ReportsView');
const costSnapshotMigration = require(
  '../../src/main/database/migrations/008_sale_item_cost_snapshot'
);

global.window = {
  AppFormatters: {
    formatCurrency(value) {
      return `K${Number(value).toFixed(2)}`;
    }
  }
};

function createReportsView() {
  const view = Object.create(ReportsView.prototype);
  view.includeSummary = true;
  view.exportRaw = false;
  return view;
}

function withFakeDocument(fakeDocument, callback) {
  const originalDocument = global.document;
  global.document = fakeDocument;
  try {
    return callback();
  } finally {
    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
  }
}

function fakeElement(overrides = {}) {
  return {
    addEventListener() {},
    ...overrides
  };
}

function fakeEscapingElement() {
  return {
    innerHTML: '',
    set textContent(value) {
      this.innerHTML = String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  };
}

function localISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test('report extras default to opt-in controls', () => {
  const host = { innerHTML: '' };
  const startInput = fakeElement({ value: '' });
  const endInput = fakeElement({ value: '' });
  const elements = new Map([
    ['reports-view', host],
    ['report-start-date', startInput],
    ['report-end-date', endInput],
    ['report-format', fakeElement({ value: 'csv' })],
    ['report-include-charts', fakeElement({ checked: false })],
    ['report-include-summary', fakeElement({ checked: false })],
    ['report-print-btn', fakeElement()],
    ['report-download-btn', fakeElement()],
    ['report-preview-close', fakeElement()],
    ['report-preview-footer-close', fakeElement()],
    ['report-preview-modal', fakeElement()]
  ]);

  withFakeDocument({
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelectorAll() {
      return [];
    }
  }, () => {
    const view = new ReportsView();

    assert.equal(view.includeCharts, false);
    assert.equal(view.includeSummary, false);
    assert.equal(startInput.value, localISODate());
    assert.equal(endInput.value, localISODate());
    assert.match(host.innerHTML, /<option value="csv" selected>CSV<\/option>/);
    assert.match(host.innerHTML, /<option value="pdf">PDF<\/option>/);
    assert.doesNotMatch(host.innerHTML, /Text File/);
    assert.doesNotMatch(host.innerHTML, /id="report-include-charts"\s+checked/);
    assert.doesNotMatch(host.innerHTML, /id="report-include-summary"\s+checked/);
  });
});

test('unchecked report extras produce table-only preview and exports', () => {
  const view = createReportsView();
  const modal = { style: {} };
  const title = { textContent: '' };
  const content = { innerHTML: '' };
  const fakeDocument = {
    getElementById(id) {
      return {
        'report-preview-modal': modal,
        'report-preview-title': title,
        'report-preview-content': content
      }[id] || null;
    },
    createElement() {
      return fakeEscapingElement();
    }
  };

  view.reportData = {
    title: 'Optional Sections Report',
    period: 'Jun 1, 2026 - Jun 30, 2026',
    headers: ['Name', 'Value'],
    rows: [['Sample', 'K10.00']],
    summary: { totalRevenue: 10 },
    chart: [{ label: 'Sample', value: 10 }],
    notices: ['Extra report context']
  };
  view.includeCharts = false;
  view.includeSummary = false;

  withFakeDocument(fakeDocument, () => view.showPreview());

  assert.doesNotMatch(content.innerHTML, /report-preview-header/);
  assert.doesNotMatch(content.innerHTML, /report-preview-summary/);
  assert.doesNotMatch(content.innerHTML, /report-chart-container/);
  assert.doesNotMatch(content.innerHTML, /report-integrity-notice/);
  assert.equal(view.buildCSV(), '"Name","Value"\n"Sample","K10.00"');

  view.includeCharts = true;
  view.includeSummary = true;
  withFakeDocument(fakeDocument, () => view.showPreview());

  assert.match(content.innerHTML, /report-preview-header/);
  assert.match(content.innerHTML, /report-preview-summary/);
  assert.match(content.innerHTML, /report-chart-container/);
  assert.match(content.innerHTML, /report-integrity-notice/);
});

test('PDF report downloads use the PDF exporter instead of print', async () => {
  const view = createReportsView();
  const calls = [];
  const originalElectronAPI = global.window.electronAPI;
  const originalPrint = global.window.print;

  view.format = 'pdf';
  view.currentReportType = 'sales-summary';
  view.reportData = {
    title: 'PDF Sales Report',
    headers: ['Sale Number', 'Category', 'Payment Method', 'Total'],
    rows: [['SALE-001', 'Electrical', 'Card', 'K110.00']],
    summary: { totalRevenue: 110 },
    chart: [{ label: 'SALE-001', value: 110 }]
  };
  view.includeCharts = false;
  view.includeSummary = false;

  global.window.electronAPI = {
    async exportReportPdf(payload) {
      calls.push(payload);
      return { success: true, data: { filePath: 'sales.pdf' } };
    }
  };
  global.window.print = () => {
    throw new Error('print should not be used for PDF downloads');
  };

  try {
    await withFakeDocument({
      createElement() {
        return fakeEscapingElement();
      }
    }, () => view.downloadReport());
  } finally {
    if (originalElectronAPI === undefined) {
      delete global.window.electronAPI;
    } else {
      global.window.electronAPI = originalElectronAPI;
    }

    if (originalPrint === undefined) {
      delete global.window.print;
    } else {
      global.window.print = originalPrint;
    }
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].landscape, true);
  assert.equal(calls[0].fullHtml, true);
  assert.match(calls[0].documentNumber, /^report-sales-summary-/);
  assert.match(calls[0].html, /<!doctype html>/);
  assert.match(calls[0].html, /report-pdf-root/);
  assert.match(calls[0].html, /report-preview-table/);
  assert.doesNotMatch(calls[0].html, /<div class="report-preview-summary"/);
  assert.match(calls[0].html, /report-category-pill/);
});

test('historical profit never falls back to the current product cost', () => {
  const view = createReportsView();
  const sale = {
    subtotal: 200,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 200,
    items: [{
      product_id: 1,
      quantity: 2,
      unit_price: 100,
      total_price: 200
    }]
  };

  assert.equal(view.getSaleCost(sale), null);
  assert.equal(view.getSaleProfit(sale), null);

  sale.items[0].unit_cost = 60;
  assert.equal(view.getSaleCost(sale), 120);
  assert.equal(view.getSaleProfit(sale), 80);
});

test('sales summary includes each sale as a full table row', () => {
  const view = createReportsView();
  const start = new Date('2026-06-01T00:00:00Z');
  const end = new Date('2026-06-30T23:59:59Z');
  const context = {
    sales: [
      {
        id: 1,
        invoice_number: 'SALE-001',
        created_at: '2026-06-10T09:00:00Z',
        customer_name: 'Acme Supplies',
        subtotal: 100,
        discount_amount: 5,
        tax_amount: 15,
        total_amount: 110,
        payment_method: 'card',
        user_full_name: 'System Admin',
        items: [{ product_name: 'Widget', category_name: 'Hardware', quantity: 2, unit_price: 50, total_price: 100, unit_cost: 30 }]
      },
      {
        id: 2,
        invoice_number: 'SALE-002',
        created_at: '2026-06-10T15:00:00Z',
        customer_name: 'Walk-in Customer',
        subtotal: 75,
        discount_amount: 0,
        tax_amount: 11.25,
        total_amount: 86.25,
        payment_method: 'cash',
        user_full_name: 'Jane Cashier',
        quantity_sold: 3,
        item_summary: 'Cable x3',
        items: [{ product_name: 'Cable', category_name: 'Accessories', quantity: 3, unit_price: 25, total_price: 75, unit_cost: 10 }]
      }
    ]
  };

  const report = view.generateSalesSummary(context, start, end);

  assert.equal(report.rows.length, 2);
  assert.deepEqual(report.headers, [
    'Sale Number',
    'Date',
    'Customer',
    'User',
    'Category',
    'Items',
    'Quantity',
    'Payment Method',
    'Subtotal',
    'Discount',
    'Tax',
    'Total',
    'Gross Profit'
  ]);
  assert.equal(report.rows[0][0], 'SALE-001');
  assert.equal(report.rows[0][3], 'System Admin');
  assert.equal(report.rows[0][4], 'Hardware');
  assert.equal(report.rows[0][5], 'Widget x2');
  assert.equal(report.rows[0][6], '2');
  assert.equal(report.rows[0][7], 'Card');
  assert.equal(report.rows[1][0], 'SALE-002');
  assert.equal(report.rows[1][3], 'Jane Cashier');
  assert.equal(report.rows[1][4], 'Accessories');
  assert.equal(report.rows[1][5], 'Cable x3');
  assert.equal(report.rows[1][6], '3');
  assert.equal(report.summary.totalTransactions, 2);
  assert.equal(report.summary.totalQuantity, 5);
});

test('paged sales loading includes every returned sales page', async () => {
  const view = createReportsView();
  const originalElectronAPI = global.window.electronAPI;
  global.window.electronAPI = {
    async getSales(filters) {
      return filters.offset < 2 ? [{ id: filters.offset + 1 }] : [];
    }
  };

  try {
    const rows = await view.safePagedApiCall('getSales', {}, 1);
    assert.deepEqual(rows, [{ id: 1 }, { id: 2 }]);
  } finally {
    if (originalElectronAPI === undefined) {
      delete global.window.electronAPI;
    } else {
      global.window.electronAPI = originalElectronAPI;
    }
  }
});

test('reports explicitly disclose unavailable cost and net profit data', () => {
  const view = createReportsView();
  const context = {
    sales: [{
      subtotal: 200,
      discount_amount: 0,
      tax_amount: 20,
      total_amount: 220,
      items: [{ quantity: 2, unit_price: 100, total_price: 200 }]
    }],
    inventory: [{
      name: 'Uncosted item',
      sku: 'UNC-1',
      quantity_on_hand: 5,
      cost_price: null,
      unit_price: 100
    }]
  };
  context.productMap = new Map();
  const start = new Date('2026-06-01T00:00:00Z');
  const end = new Date('2026-06-30T23:59:59Z');

  const salesSummary = view.generateSalesSummary(context, start, end);
  assert.equal(salesSummary.summary.totalGrossProfit, null);
  assert.match(salesSummary.rows[0][12], /missing verified cost data/i);
  assert.match(salesSummary.notices.join(' '), /transaction-time cost snapshot/i);

  const salesByProduct = view.generateSalesByProduct(context, start, end);
  assert.equal(salesByProduct.summary.totalGrossProfit, null);
  assert.match(salesByProduct.rows[0][4], /missing verified cost data/i);
  assert.match(salesByProduct.notices.join(' '), /transaction-time cost snapshot/i);

  const profitLoss = view.generateProfitLoss(context, start, end);
  assert.equal(profitLoss.summary.costOfGoodsSold, null);
  assert.equal(profitLoss.summary.grossProfit, null);
  assert.equal(profitLoss.summary.netProfit, null);
  assert.match(profitLoss.notices.join(' '), /transaction-time cost snapshot/i);
  assert.match(profitLoss.notices.join(' '), /expense data is not recorded/i);

  const valuation = view.generateInventoryValuation(context);
  assert.equal(valuation.summary.totalCostValue, null);
  assert.equal(valuation.summary.missingCostItems, 1);
  assert.match(valuation.rows[0][4], /missing verified cost data/i);
  assert.match(valuation.notices.join(' '), /never substituted/i);

  view.reportData = profitLoss;
  const csv = view.buildCSV();
  assert.match(csv, /Data Availability/);
  assert.match(csv, /transaction-time cost snapshot/i);
  assert.match(csv, /expense data is not recorded/i);
});

test('cost snapshot migration adds a nullable column without inventing history', async (t) => {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true
  });
  t.after(() => db.destroy());

  await db.schema.createTable('sale_items', (table) => {
    table.increments('id').primary();
    table.integer('sale_id').notNullable();
    table.integer('product_id').notNullable();
    table.integer('quantity').notNullable();
    table.decimal('unit_price', 10, 2).notNullable();
    table.decimal('total_price', 10, 2).notNullable();
  });
  await db('sale_items').insert({
    sale_id: 1,
    product_id: 1,
    quantity: 1,
    unit_price: 100,
    total_price: 100
  });

  await costSnapshotMigration.up(db);

  assert.equal(await db.schema.hasColumn('sale_items', 'unit_cost'), true);
  const existingRow = await db('sale_items').first();
  assert.equal(existingRow.unit_cost, null);
});

test('sale persistence records database cost at transaction time', async (t) => {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true
  });
  const connectionPath = require.resolve('../../src/main/database/connection');
  const repositoryPath = require.resolve('../../src/main/repositories/sale-repository');
  const originalConnectionModule = require.cache[connectionPath];

  require.cache[connectionPath] = {
    id: connectionPath,
    filename: connectionPath,
    loaded: true,
    exports: { getDatabase: () => db }
  };
  delete require.cache[repositoryPath];
  const saleRepository = require(repositoryPath);

  t.after(async () => {
    if (originalConnectionModule) {
      require.cache[connectionPath] = originalConnectionModule;
    } else {
      delete require.cache[connectionPath];
    }
    delete require.cache[repositoryPath];
    await db.destroy();
  });

  await db.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.decimal('cost_price', 10, 2);
  });
  await db.schema.createTable('sales', (table) => {
    table.increments('id').primary();
    table.string('invoice_number', 50).notNullable();
    table.integer('customer_id');
    table.decimal('subtotal', 10, 2).notNullable();
    table.decimal('tax_amount', 10, 2).notNullable();
    table.decimal('discount_amount', 10, 2).notNullable();
    table.decimal('total_amount', 10, 2).notNullable();
    table.string('payment_method', 50);
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

  const [productId] = await db('products').insert({ cost_price: 60 });
  await saleRepository.create({
    invoiceNumber: 'REP-01-1',
    customerId: null,
    subtotal: 200,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 200,
    paymentMethod: 'cash',
    userId: 1,
    items: [{
      productId,
      quantity: 2,
      unitPrice: 100,
      unitCost: 1
    }]
  });

  await db('products').where('id', productId).update({ cost_price: 90 });

  const persistedItem = await db('sale_items').first();
  assert.equal(Number(persistedItem.unit_cost), 60);
});
