/**
 * Renderer Auth Startup Test
 * Verifies data-backed views wait for the authenticated application bootstrap.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');
}

test('product and dashboard views do not load before session validation', () => {
  const productsSource = read('src/renderer/js/views/ProductsView.js');
  const dashboardSource = read('src/renderer/js/views/dashboardView.js');
  const appSource = read('src/renderer/js/app.js');

  assert.equal(productsSource.includes('new ProductsView();'), false);
  assert.equal(dashboardSource.includes('window.dashboard = new Dashboard();'), false);
  assert.match(appSource, /if \(!await this\.checkAuth\(\)\)/);
  assert.match(appSource, /window\.productsView = new ProductsView\(\)/);
  assert.match(appSource, /window\.dashboard = new Dashboard\(\)/);
});
