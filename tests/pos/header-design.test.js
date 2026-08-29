'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const appRoot = path.join(__dirname, '../..');
const indexHtml = fs.readFileSync(path.join(appRoot, 'src/renderer/index.html'), 'utf8');
const posCss = fs.readFileSync(path.join(appRoot, 'src/renderer/styles/views/pos.css'), 'utf8');
const uiPolishCss = fs.readFileSync(path.join(appRoot, 'src/renderer/styles/ui-polish.css'), 'utf8');

test('POS header uses a compact light grey command bar design', () => {
  assert.match(indexHtml, /<header class="pos-header">[\s\S]*?<h1 class="pos-title">Point of Sale<\/h1>/);
  assert.match(
    posCss,
    /#pos-view \.pos-header\s*\{[\s\S]*?height:\s*58px;[\s\S]*?min-height:\s*58px;[\s\S]*?padding:\s*0 18px;[\s\S]*?background:\s*linear-gradient\(180deg,\s*#f3f4f6 0%,\s*#e5e7eb 100%\);/
  );
  assert.match(
    uiPolishCss,
    /#pos-view \.pos-header\s*\{[\s\S]*?min-height:\s*58px;[\s\S]*?height:\s*58px;[\s\S]*?padding:\s*0 18px;/
  );
  assert.match(
    posCss,
    /#pos-view \.pos-back-btn\s*\{[\s\S]*?width:\s*32px;[\s\S]*?height:\s*32px;[\s\S]*?border-radius:\s*10px;/
  );
  assert.match(
    posCss,
    /#pos-view \.pos-title\s*\{[\s\S]*?color:\s*#111827;[\s\S]*?font-size:\s*18px;[\s\S]*?font-weight:\s*800;/
  );
});

test('POS session controls render as compact status chips', () => {
  assert.match(
    posCss,
    /#pos-view \.pos-header-right\s*\{[\s\S]*?gap:\s*6px;[\s\S]*?padding:\s*4px;[\s\S]*?border-radius:\s*999px;/
  );
  assert.match(
    posCss,
    /#pos-view \.session-timer\s*\{[\s\S]*?min-width:\s*118px;[\s\S]*?height:\s*34px;[\s\S]*?border-radius:\s*999px;/
  );
  assert.match(
    posCss,
    /#pos-view \.session-btn\s*\{[\s\S]*?min-width:\s*62px;[\s\S]*?height:\s*34px;[\s\S]*?font-size:\s*11px;/
  );
  assert.match(
    posCss,
    /#pos-view \.session-btn\.live\.active\s*\{[\s\S]*?background:\s*#ef4444;[\s\S]*?color:\s*#ffffff;/
  );
});
