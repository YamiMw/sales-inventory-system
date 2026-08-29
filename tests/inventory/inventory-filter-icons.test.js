'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const appRoot = path.join(__dirname, '../..');
const inventoryCss = fs.readFileSync(
  path.join(appRoot, 'src/renderer/styles/views/inventory.css'),
  'utf8'
);
const indexHtml = fs.readFileSync(path.join(appRoot, 'src/renderer/index.html'), 'utf8');

test('inventory refresh filter button uses only its image icon', () => {
  assert.match(indexHtml, /id="refresh-inventory-btn"[\s\S]*?<img src="assets\/images\/icons\/custom\/refresh_icon\.png"/);
  assert.doesNotMatch(inventoryCss, /#inventory-view \.inventory-filter-bar #refresh-inventory-btn::before/);
  assert.match(inventoryCss, /#inventory-view \.inventory-filter-bar #refresh-inventory-btn img\s*\{[\s\S]*?width:\s*22px;[\s\S]*?height:\s*22px;/);
});

test('inventory filter bar matches the compact sales view style', () => {
  assert.match(
    inventoryCss,
    /#inventory-view \.inventory-filter-bar\s*\{[\s\S]*?grid-template-columns:\s*minmax\(240px,\s*1fr\)\s+210px\s+165px\s+auto\s+40px;[\s\S]*?min-height:\s*64px;[\s\S]*?padding:\s*8px 14px;[\s\S]*?border-radius:\s*16px;/
  );
  assert.match(
    inventoryCss,
    /#inventory-view \.inventory-filter-bar \.search-input,[\s\S]*?#inventory-view \.inventory-filter-bar #refresh-inventory-btn\s*\{[\s\S]*?height:\s*38px;[\s\S]*?border-radius:\s*12px;/
  );
  assert.match(
    inventoryCss,
    /#inventory-view \.inventory-filter-bar \.search-icon,[\s\S]*?#inventory-view \.inventory-filter-bar \.filter-icon\s*\{[\s\S]*?width:\s*18px;[\s\S]*?filter:\s*brightness\(0\)/
  );
  assert.match(
    inventoryCss,
    /#inventory-view \.inventory-filter-bar \.search-icon::before,[\s\S]*?#inventory-view \.inventory-filter-bar \.filter-icon::before\s*\{[\s\S]*?content:\s*none;/
  );
  assert.match(
    inventoryCss,
    /@media \(max-width:\s*1100px\)\s*\{[\s\S]*?#inventory-view \.inventory-filter-bar\s*\{[\s\S]*?grid-template-columns:\s*minmax\(220px,\s*1fr\)\s+190px\s+155px\s+auto\s+40px;[\s\S]*?gap:\s*10px;/
  );
});
