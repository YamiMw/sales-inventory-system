'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const customersCss = fs.readFileSync(
  path.join(__dirname, '../../src/renderer/styles/views/customers.css'),
  'utf8'
);

test('add customer dialogs stay centered in the profile-style panel', () => {
  assert.match(customersCss, /#customer-form-modal\.customer-form-overlay,\s+[\s\S]*?#document-customer-form-modal\.documents-customer-modal-overlay\s*\{[\s\S]*?align-items:\s*center !important;[\s\S]*?justify-content:\s*center !important;/);
  assert.match(customersCss, /#customer-form-modal \.modal\.customer-form-modal,\s+[\s\S]*?#document-customer-form-modal \.modal\.documents-customer-modal\s*\{[\s\S]*?width:\s*min\(750px,\s*calc\(100vw - 36px\)\) !important;[\s\S]*?border-radius:\s*22px !important;/);
  assert.match(customersCss, /#customer-form-modal \.modal-header,\s+[\s\S]*?#document-customer-form-modal \.modal-header\s*\{[\s\S]*?min-height:\s*86px !important;[\s\S]*?padding:\s*20px 30px 18px !important;[\s\S]*?background:\s*#111827 !important;/);
  assert.match(customersCss, /#customer-form-modal \.modal-header h2::before,\s+[\s\S]*?#document-customer-form-modal \.modal-header h2::before\s*\{[\s\S]*?content:\s*"Customer Profile";/);
});

test('add customer fields use profile-card styling with smaller controls', () => {
  assert.match(customersCss, /#customer-form-modal \.form-group:first-of-type,\s+[\s\S]*?#document-customer-form-modal \.pos-customer-field\.full\s*\{[\s\S]*?grid-column:\s*auto !important;/);
  assert.match(customersCss, /#customer-form-modal \.form-group,\s+[\s\S]*?#document-customer-form-modal \.pos-customer-field\s*\{[\s\S]*?min-height:\s*66px !important;[\s\S]*?background:\s*#f8fafc !important;/);
  assert.match(customersCss, /#customer-form-modal \.form-group input,\s+[\s\S]*?#document-customer-form-modal \.pos-customer-field select\s*\{[\s\S]*?height:\s*20px !important;[\s\S]*?font-size:\s*14px !important;/);
  assert.match(customersCss, /#customer-form-modal \.form-group textarea,\s+[\s\S]*?#document-customer-form-modal \.pos-customer-field textarea\s*\{[\s\S]*?min-height:\s*36px !important;[\s\S]*?font-size:\s*14px !important;/);
});
