'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('node:vm');

const appRoot = path.join(__dirname, '../..');

function loadViewClass() {
  const sources = [
    'src/renderer/js/views/QuotationsInvoicesView.js',
    'src/renderer/js/views/QuotationsInvoicesView.events.js',
    'src/renderer/js/views/QuotationsInvoicesView.form.js',
    'src/renderer/js/views/QuotationsInvoicesView.printing.js',
    'src/renderer/js/views/QuotationsInvoicesView.actions.js',
    'src/renderer/js/views/QuotationsInvoicesView.detail.js'
  ].map(relativePath => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')).join('\n');
  const context = {
    console,
    setTimeout,
    window: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      createElement: () => ({})
    }
  };

  vm.createContext(context);
  return vm.runInContext(`${sources}\nwindow.QuotationsInvoicesView;`, context);
}

function createInvoiceView() {
  const View = loadViewClass();
  const calls = {
    clearedSearch: 0,
    hiddenResults: 0,
    rendered: 0,
    focusedIndex: null
  };
  const view = Object.create(View.prototype);
  view.products = [
    { id: 7, name: 'Test Product', price: 15 },
    { id: 8, name: 'Other Product', price: 30 }
  ];
  view.lines = [];
  view.canEditDocumentLines = () => true;
  view.getProductPrice = product => product.price;
  view.clearProductSearch = () => { calls.clearedSearch += 1; };
  view.hideLookupResults = () => { calls.hiddenResults += 1; };
  view.renderLines = () => { calls.rendered += 1; };
  view.focusLineQuantity = index => { calls.focusedIndex = index; };
  return { view, calls };
}

test('invoice product search adds to the existing quantity instead of creating a duplicate row', () => {
  const { view, calls } = createInvoiceView();
  view.lines = [
    { productId: 7, quantity: 2, unitPrice: 15, discountPercent: 0 }
  ];

  view.addProductLine('7');

  assert.equal(view.lines.length, 1);
  assert.equal(view.lines[0].quantity, 3);
  assert.equal(calls.rendered, 1);
  assert.equal(calls.clearedSearch, 1);
  assert.equal(calls.hiddenResults, 1);
  assert.equal(calls.focusedIndex, 0);
});

test('invoice product dropdown merges duplicate rows and preserves total quantity', () => {
  const { view, calls } = createInvoiceView();
  view.lines = [
    { productId: 7, quantity: 2, unitPrice: 15, discountPercent: 0 },
    { productId: '', quantity: 4, unitPrice: 0, discountPercent: 0 }
  ];

  view.handleLineChange({
    target: {
      value: '7',
      dataset: { lineField: 'productId' },
      closest: () => ({ dataset: { lineIndex: '1' } })
    }
  });

  assert.equal(view.lines.length, 1);
  assert.equal(view.lines[0].quantity, 6);
  assert.equal(calls.rendered, 1);
  assert.equal(calls.focusedIndex, 0);
});
