/**
 * Commerce Handler Size Test
 * Keeps commerce IPC registration split into maintainable modules.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.join(__dirname, '../..');
const commerceDirectory = path.join(appRoot, 'src/main/ipc/live');
const coordinatorPath = path.join(commerceDirectory, 'commerce-handlers.js');
const focusedModules = [
  'commerce-sales-handlers.js',
  'commerce-quotation-handlers.js',
  'commerce-invoice-handlers.js',
  'commerce-approval-handlers.js',
  'commerce-invoice-action-handlers.js',
  'commerce-export-handlers.js'
];

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

test('commerce handler coordinator only wires focused modules', () => {
  const source = fs.readFileSync(coordinatorPath, 'utf8');

  assert.ok(readLines(coordinatorPath).length <= 80, 'commerce-handlers.js should stay as a small coordinator');
  assert.doesNotMatch(source, /secureIpc\.handle\(/);

  for (const moduleName of focusedModules) {
    assert.match(source, new RegExp(`require\\('./${moduleName.replace(/\.js$/, '')}'\\)`));
  }
});

test('focused commerce handler modules stay below large-file threshold', () => {
  for (const moduleName of focusedModules) {
    const modulePath = path.join(commerceDirectory, moduleName);
    const source = fs.readFileSync(modulePath, 'utf8');

    assert.ok(source.includes('secureIpc.handle('), `${moduleName} should register commerce handlers`);
    assert.ok(readLines(modulePath).length <= 350, `${moduleName} should stay focused and maintainable`);
  }
});
