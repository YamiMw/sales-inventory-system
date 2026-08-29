'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const appRoot = path.join(__dirname, '../..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

test('invoice PDF export keeps a bottom page line and overflow-page spacing', () => {
  const css = readSource('src/renderer/styles/views/document-pdf.css');

  assert.match(css, /@page\s*\{[\s\S]*?margin:\s*15mm 0 18mm;/);
  assert.match(css, /body::after\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*8mm;[\s\S]*?border-bottom:\s*0\.35mm solid #000000;/);
  assert.match(css, /\.documents-print-sheet,\s*[\r\n]+\.documents-elegant-sheet\s*\{[\s\S]*?min-height:\s*264mm;[\s\S]*?padding:\s*3mm 13mm 8mm;/);
  assert.match(css, /\.documents-elegant-items thead\s*\{[\s\S]*?display:\s*table-header-group;/);
});

test('invoice print preview matches PDF page margins and repeated item headers', () => {
  const css = readSource('src/renderer/styles/views/documents.css');

  assert.match(css, /@media print\s*\{[\s\S]*?@page\s*\{[\s\S]*?margin:\s*15mm 0 18mm;/);
  assert.match(css, /body\.documents-print-preview::after,\s+body\.documents-print-detail::after\s*\{[\s\S]*?bottom:\s*8mm;[\s\S]*?border-bottom:\s*0\.35mm solid #000000;/);
  assert.match(css, /\.documents-elegant-items thead\s*\{[\s\S]*?display:\s*table-header-group;/);
});
