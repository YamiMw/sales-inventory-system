/**
 * Receipt Print Design Test
 * Verifies the thermal receipt markup follows the configured compact receipt design.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('vm');

function loadReceiptPrinter() {
  const context = { Intl, Date, Number, Object, String, Array, Math };
  context.globalThis = context;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../../src/renderer/js/utils/formatters.js'), 'utf8'),
    context
  );
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../../src/renderer/js/utils/printer.js'), 'utf8'),
    context
  );
  context.AppFormatters.configure({
    date_format: 'YYYY-MM-DD',
    time_format: '24-hour',
    timezone: 'UTC',
    tax_name: 'VAT'
  });
  return context.ReceiptPrinter;
}

test('receipt print markup follows the provided customer/item/payment layout', () => {
  const printer = loadReceiptPrinter();
  const html = printer.receiptHtml({
    invoiceNumber: 'POS-2026-0001',
    createdAt: '2026-07-24T21:30:00.000Z',
    customerName: 'Market Counter',
    customerAddress: '1 & 2 Trading Road',
    subtotal: 75,
    tax: 15,
    total: 75,
    amountPaid: 100,
    change: 25,
    items: [
      {
        name: 'Notebook',
        unitPrice: 25,
        quantity: 2,
        totalPrice: 50
      },
      {
        productName: 'Pen Pack',
        price: 25,
        quantity: 1
      }
    ]
  }, {
    company_name: 'Aliko Business Enterprise',
    company_address: 'Main Market',
    company_city: 'Blantyre',
    company_phone: '0999 000 111',
    company_tax_id: 'TPIN-12345',
    tax_name: 'VAT',
    tax_show_separate: true,
    printer_header: 'Thank you for buying from us!',
    printer_footer: ''
  });

  assert.match(html, /Aliko Business Enterprise/);
  assert.match(html, /Address: Main Market, Blantyre/);
  assert.match(html, /Phone Number: 0999 000 111/);
  assert.match(html, /TPIN: TPIN-12345/);
  assert.match(html, /Customer name:/);
  assert.match(html, /Market Counter/);
  assert.match(html, /Customer address:/);
  assert.match(html, /1 &amp; 2 Trading Road/);
  assert.match(html, /Product name/);
  assert.match(html, /Unit Price/);
  assert.match(html, /Qty/);
  assert.match(html, /Grand Total:/);
  assert.match(html, /Amount Paid:/);
  assert.match(html, /Change:/);
  assert.match(html, /<td class="item-price">K25\.00<\/td>/);
  assert.match(html, /<td class="item-qty">2<\/td>/);
  assert.match(html, /<td class="item-total">K50\.00<\/td>/);
  assert.match(html, /VAT:/);
  assert.match(html, /K100\.00/);
  assert.match(html, /K25\.00/);
});

test('receipt markup builds item rows without throwing', () => {
  const printer = loadReceiptPrinter();

  assert.doesNotThrow(() => {
    printer.receiptHtml({
      invoiceNumber: 'POS-2026-0002',
      createdAt: '2026-07-24T21:30:00.000Z',
      customerName: 'Walk-in Customer',
      subtotal: 50,
      tax: 10,
      total: 60,
      amountPaid: 60,
      change: 0,
      items: [
        { name: 'Coffee', unitPrice: 25, quantity: 2, totalPrice: 50 }
      ]
    }, {
      company_name: 'Aliko Business Enterprise',
      tax_name: 'VAT',
      tax_show_separate: true,
      printer_header: 'Thank you for buying from us!'
    });
  });
});
