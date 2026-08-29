'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const appRoot = path.join(__dirname, '../..');
const indexHtml = fs.readFileSync(path.join(appRoot, 'src/renderer/index.html'), 'utf8');
const posSource = fs.readFileSync(path.join(appRoot, 'src/renderer/js/views/POSView.js'), 'utf8');
const posCss = fs.readFileSync(path.join(appRoot, 'src/renderer/styles/views/pos.css'), 'utf8');

function paymentModalMarkup() {
  const match = indexHtml.match(/<div id="pos-payment-modal"[\s\S]*?<div id="pos-customer-form-modal"/);
  assert.ok(match, 'payment modal markup should be present');
  return match[0];
}

test('process payment popup keeps only three quick amount options', () => {
  const modal = paymentModalMarkup();
  assert.equal((modal.match(/data-payment-quick=/g) || []).length, 3);
  assert.doesNotMatch(modal, /data-payment-exact|Exact:/);
  assert.doesNotMatch(posSource, /data-payment-exact|Exact:/);
});

test('process payment popup uses compact fields and green primary action', () => {
  assert.match(posCss, /#pos-payment-modal\.pos-payment-modal-overlay\s*\{[\s\S]*?align-items:\s*center !important;[\s\S]*?justify-content:\s*center !important;/);
  assert.match(posCss, /#pos-payment-modal \.pos-payment-modal \.modal-header\s*\{[\s\S]*?min-height:\s*76px !important;[\s\S]*?padding:\s*18px 26px 16px !important;/);
  assert.match(posCss, /#pos-payment-modal \.pos-payment-quick-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\) !important;/);
  assert.match(posCss, /#pos-payment-modal \.pos-payment-amount-input input\s*\{[\s\S]*?height:\s*20px !important;[\s\S]*?font-size:\s*14px !important;/);
  assert.match(posCss, /#pos-payment-modal \.pos-payment-field:focus-within,\s+[\s\S]*?#pos-payment-modal \.pos-payment-amount-input input:focus-visible\s*\{[\s\S]*?outline:\s*0 !important;[\s\S]*?box-shadow:\s*none !important;/);
  assert.match(posCss, /#pos-payment-modal \.pos-change-card span\s*\{[\s\S]*?color:\s*#dc2626 !important;/);
  assert.match(posCss, /#pos-payment-modal \.pos-change-card strong\s*\{[\s\S]*?color:\s*#dc2626 !important;/);
  assert.match(posCss, /#pos-payment-modal \.pos-payment-notes textarea\s*\{[\s\S]*?min-height:\s*36px !important;[\s\S]*?font-size:\s*12px !important;/);
  assert.match(posCss, /#pos-payment-modal \.pos-process-payment\s*\{[\s\S]*?background:\s*#16a34a !important;/);
});
