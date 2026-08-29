/**
 * No Production Mocks Test
 * Verifies no production mocks behavior and regression boundaries.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..', '..');
const productionFiles = [
  'src/renderer/js/views/CustomersView.js',
  'src/renderer/js/views/ProductsView.js',
  'src/renderer/js/views/InventoryView.js',
  'src/renderer/js/views/POSView.js',
  'src/renderer/js/views/dashboardView.js',
  'src/renderer/js/views/ReportsView.js',
  'src/renderer/js/login.js',
  'src/renderer/js/views/LoginView.js',
  'src/renderer/index.html',
  'src/main/main.js',
  'src/main/repositories/dashboard-repository.js',
  'src/main/services/dashboard-service.js'
];

const forbiddenPatterns = [
  [/\bgetMock[A-Za-z0-9_]*\b/i, 'mock data factory'],
  [/\bmockStats\b/i, 'mock dashboard statistics'],
  [/\bloadChartMock\b/i, 'mock chart loader'],
  [/Using demo data/i, 'demo-data fallback'],
  [/demo credentials/i, 'production demo credentials'],
  [/updated locally/i, 'local-only update fallback'],
  [/creating locally/i, 'local-only create fallback'],
  [/deleting locally/i, 'local-only delete fallback'],
  [/Portland Cement \(50kg\)/i, 'sample product record'],
  [/\bJohn Smith\b/i, 'sample customer record'],
  [/\bABC Corporation\b/i, 'sample customer record'],
  [/\b4SJHZZSE\b/i, 'sample sale record']
];

test('production views contain no mock records or fake-success fallback markers', () => {
  for (const relativePath of productionFiles) {
    const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
    for (const [pattern, description] of forbiddenPatterns) {
      assert.doesNotMatch(source, pattern, `${relativePath} contains a ${description}`);
    }
  }
});

test('reports do not estimate missing costs or profit', () => {
  const reportSource = fs.readFileSync(
    path.join(appRoot, 'src/renderer/js/views/ReportsView.js'), 'utf8'
  );
  const dashboardSources = [
    'src/main/main.js',
    'src/main/repositories/dashboard-repository.js',
    'src/main/services/dashboard-service.js'
  ].map(relativePath => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')).join('\n');

  assert.doesNotMatch(reportSource, /revenue\s*\*\s*0\.35/);
  assert.doesNotMatch(reportSource, /totalRevenue\s*\*\s*0\.65/);
  assert.doesNotMatch(dashboardSources, /salesData\.map\([^)]*\*\s*0\.35/);
  assert.doesNotMatch(dashboardSources, /r\.sales\s*\*\s*0\.3/);
  assert.match(reportSource, /if \(cost === null\) return null;/);
  assert.match(reportSource, /showReportError\(reportType, error\)/);
});

test('data-backed views expose explicit load errors', () => {
  const expectedMarkers = new Map([
    ['src/renderer/js/views/CustomersView.js', 'Unable to load customers'],
    ['src/renderer/js/views/ProductsView.js', 'Unable to load products'],
    ['src/renderer/js/views/InventoryView.js', 'Unable to load inventory'],
    ['src/renderer/js/views/POSView.js', 'Unable to load products'],
    ['src/renderer/js/views/dashboardView.js', 'Dashboard statistics are unavailable'],
    ['src/renderer/js/views/ReportsView.js', 'Unable to generate']
  ]);

  for (const [relativePath, marker] of expectedMarkers) {
    const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
    assert.match(source, new RegExp(marker, 'i'), `${relativePath} lacks an explicit error state`);
  }
});
