/**
 * Release Branding Test
 * Keeps distributable metadata aligned with the Aliko Business Enterprise brand.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.join(__dirname, '../..');
const releaseAppId = 'com.alikobusinessenterprise.salesinventory';
const releaseName = 'Aliko Business Enterprise';

test('electron builder release metadata uses production branding', () => {
  const source = fs.readFileSync(path.join(appRoot, 'electron-builder.yml'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));

  assert.match(source, new RegExp(`^appId: ${releaseAppId}$`, 'm'));
  assert.match(source, new RegExp(`^productName: "${releaseName}"$`, 'm'));
  assert.match(source, new RegExp(`^  shortcutName: "${releaseName}"$`, 'm'));
  assert.match(source, new RegExp(`^copyright: "Copyright \\(C\\) 2026 ${releaseName}"$`, 'm'));
  assert.equal(pkg.author, releaseName);

  assert.doesNotMatch(source, /yourcompany/i);
  assert.doesNotMatch(source, /Your Company/);
  assert.doesNotMatch(source, /Sales & Inventory System/);
});

test('windows app user model id matches release app id', () => {
  const source = fs.readFileSync(path.join(appRoot, 'src/main/main.js'), 'utf8');

  assert.match(source, new RegExp(`APP_USER_MODEL_ID = '${releaseAppId}'`));
  assert.doesNotMatch(source, /com\.yourcompany\.salesinventory/);
});
