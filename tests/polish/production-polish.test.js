/**
 * Production Polish Test
 * Guards release-facing UX and packaging smoke coverage.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.join(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

function listFiles(directory, predicate) {
  const absolute = path.join(appRoot, directory);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(relative, predicate);
    return predicate(relative) ? [relative] : [];
  });
}

test('renderer uses app-styled dialogs instead of native browser popups', () => {
  const files = [
    ...listFiles('src/renderer/js', file => file.endsWith('.js')),
    'src/renderer/index.html',
    'src/renderer/login.html'
  ];
  const nativeDialogPattern = /(^|[^.\w$])(window\.)?(alert|confirm|prompt)\s*\(/;

  for (const file of files) {
    assert.doesNotMatch(read(file), nativeDialogPattern, `${file} should not call a native browser dialog`);
  }

  const index = read('src/renderer/index.html');
  assert.match(index, /<script src="js\/utils\/app-dialogs\.js"><\/script>/);
});

test('renderer production path avoids console.log noise', () => {
  const files = [
    'src/main/preload.js',
    ...listFiles('src/renderer/js', file => file.endsWith('.js'))
  ];

  for (const file of files) {
    assert.doesNotMatch(read(file), /console\.log\s*\(/, `${file} should not write routine production logs`);
  }
});

test('packaging smoke launches Electron and verifies native SQLite', () => {
  const packageJson = JSON.parse(read('package.json'));
  const smokeScript = read('scripts/packaging-smoke.js');
  const mainSource = read('src/main/main.js');

  assert.match(packageJson.scripts['package:smoke'], /rebuild:electron/);
  assert.match(packageJson.scripts['package:smoke'], /scripts\/packaging-smoke\.js|scripts\\packaging-smoke\.js/);
  assert.match(smokeScript, /spawn\(electronPath,\s*\['\.'\]/);
  assert.match(smokeScript, /SALES_INVENTORY_PACKAGING_SMOKE/);
  assert.match(smokeScript, /PACKAGING_SMOKE_OK/);
  assert.match(mainSource, /function verifyNativeSqliteBinding\(\)/);
  assert.match(mainSource, /require\('better-sqlite3'\)/);
  assert.match(mainSource, /runPackagingSmokeTest/);
});
