/**
 * Settings Source Test
 * Verifies settings source behavior and regression boundaries.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('vm');

test('settings view does not read or write a local settings override', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../src/renderer/js/views/SettingsView.js'),
    'utf8'
  );
  assert.equal(source.includes('app_settings'), false);
  assert.equal(source.includes('Settings saved on this device'), false);
});

test('runtime formatters use Malawi Kwacha while honoring date, time, timezone, and tax label', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../src/renderer/js/utils/formatters.js'),
    'utf8'
  );
  const context = { Intl, Date, Number, Object };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  context.AppFormatters.configure({
    currency: 'USD',
    date_format: 'YYYY-MM-DD',
    time_format: '24-hour',
    timezone: 'UTC',
    tax_name: 'GST'
  });
  assert.equal(context.AppFormatters.currencyCode, 'MWK');
  assert.equal(context.AppFormatters.formatCurrency(12.5), 'K12.50');
  assert.equal(context.AppFormatters.formatDate('2026-06-13T12:00:00Z'), '2026-06-13');
  assert.equal(context.AppFormatters.taxLabel, 'GST');
  assert.equal(context.AppFormatters.timezone, 'UTC');
});

test('currency selection is locked to Malawi Kwacha over stale saved values', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../src/renderer/js/utils/formatters.js'),
    'utf8'
  );
  const context = { Intl, Date, Number, Object };
  context.globalThis = context;
  vm.runInNewContext(source, context);

  context.AppFormatters.configure({
    currency: 'USD',
    currency_symbol: 'K'
  });

  assert.equal(context.AppFormatters.currencyCode, 'MWK');
  assert.equal(context.AppFormatters.currencySymbol, 'K');
  assert.equal(context.AppFormatters.formatCurrency(12.5), 'K12.50');
  assert.equal(context.AppFormatters.formatCompactCurrency(1250), 'K1.3k');
});

test('currency display paths do not retain hard-coded Kwacha placeholders', () => {
  const files = [
    'src/renderer/index.html',
    'src/renderer/js/components/Chart.js',
    'src/renderer/js/views/POSView.js',
    'src/renderer/js/views/QuotationsInvoicesView.js',
    'src/renderer/js/views/ReportsView.js',
    'src/renderer/js/views/salesView.js'
  ];
  const source = files.map(file =>
    fs.readFileSync(path.join(__dirname, '../..', file), 'utf8')
  ).join('\n');

  assert.equal(source.includes('K0.00'), false);
  assert.equal(source.includes('formatCurrencyK'), false);
});

test('user management exposes accurate create-user requirements', () => {
  const usersViewSource = fs.readFileSync(
    path.join(__dirname, '../../src/renderer/js/views/UsersView.js'),
    'utf8'
  );
  const indexSource = fs.readFileSync(
    path.join(__dirname, '../../src/renderer/index.html'),
    'utf8'
  );
  const userHandlersSource = fs.readFileSync(
    path.join(__dirname, '../../src/main/ipc/live/user-handlers.js'),
    'utf8'
  );

  assert.match(usersViewSource, /create_user/);
  assert.match(usersViewSource, /edit_user/);
  assert.match(usersViewSource, /delete_user/);
  assert.doesNotMatch(usersViewSource, /Password must be at least 8 characters/);
  assert.doesNotMatch(indexSource, /Enter at least 8 characters/);
  assert.doesNotMatch(userHandlersSource, /Password must be at least 8 characters/);
  assert.match(usersViewSource, /password\.length >= 12/);
  assert.match(indexSource, /id="user-details-reset-password"/);
  assert.match(usersViewSource, /currentUserCanResetPasswords/);
  assert.match(usersViewSource, /openResetPassword\(id\)/);
});

test('regular customer fallback is consistently named Walk-in Customer', () => {
  const files = [
    'src/renderer/index.html',
    'src/renderer/js/components/Dashboard.tsx',
    'src/renderer/js/views/dashboardView.js',
    'src/renderer/js/views/salesView.js',
    'src/renderer/js/views/QuotationsInvoicesView.js',
    'src/renderer/js/views/ReportsView.js'
  ];
  const source = files.map(file =>
    fs.readFileSync(path.join(__dirname, '../..', file), 'utf8')
  ).join('\n');

  assert.match(source, /Walk-in Customer/);
  assert.doesNotMatch(source, /Guest/);
  assert.doesNotMatch(source, /['"]Walk-in['"]/);
  assert.doesNotMatch(source, /\|\|\s*['"]Customer['"]/);
});
