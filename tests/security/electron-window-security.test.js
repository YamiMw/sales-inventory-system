/**
 * Electron Window Security Test
 * Verifies renderer process hardening boundaries.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.join(__dirname, '../..');
const rendererHtmlFiles = [
  'src/renderer/index.html',
  'src/renderer/login.html'
];

function getDirective(csp, name) {
  return csp
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name} `)) || '';
}

test('main application window enables Electron sandboxing', () => {
  const source = fs.readFileSync(path.join(appRoot, 'src/main/main.js'), 'utf8');
  const webPreferencesMatch = source.match(/webPreferences:\s*\{[\s\S]*?\n\s*\}/);

  assert.ok(webPreferencesMatch, 'main window webPreferences should be declared');
  assert.match(webPreferencesMatch[0], /nodeIntegration:\s*false/);
  assert.match(webPreferencesMatch[0], /contextIsolation:\s*true/);
  assert.match(webPreferencesMatch[0], /sandbox:\s*true/);
  assert.doesNotMatch(webPreferencesMatch[0], /sandbox:\s*false/);
});

test('preload avoids Node-only OS access for sandbox compatibility', () => {
  const source = fs.readFileSync(path.join(appRoot, 'src/main/preload.js'), 'utf8');

  assert.doesNotMatch(source, /require\(['"]os['"]\)/);
  assert.doesNotMatch(source, /process\.env/);
});

test('renderer entry pages define a restrictive content security policy', () => {
  for (const relativePath of rendererHtmlFiles) {
    const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
    const cspMatch = source.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)">/);

    assert.ok(cspMatch, `${relativePath} should define a CSP meta tag`);

    const csp = cspMatch[1];
    assert.equal(getDirective(csp, 'default-src'), "default-src 'self'");
    assert.equal(getDirective(csp, 'script-src'), "script-src 'self'");
    assert.equal(getDirective(csp, 'script-src-attr'), "script-src-attr 'none'");
    assert.equal(getDirective(csp, 'object-src'), "object-src 'none'");
    assert.equal(getDirective(csp, 'frame-src'), "frame-src 'none'");
    assert.equal(getDirective(csp, 'base-uri'), "base-uri 'none'");
    assert.equal(getDirective(csp, 'form-action'), "form-action 'self'");
    assert.doesNotMatch(getDirective(csp, 'script-src'), /'unsafe-inline'/);
  }
});

test('renderer entry pages avoid inline scripts and inline event handlers', () => {
  for (const relativePath of rendererHtmlFiles) {
    const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8');

    assert.doesNotMatch(source, /<script\b(?![^>]*\bsrc=)[^>]*>/i, `${relativePath} should not use inline script tags`);
    assert.doesNotMatch(source, /\son[a-z]+\s*=/i, `${relativePath} should not use inline event attributes`);
    assert.doesNotMatch(source, /\bhref=["']\s*javascript:/i, `${relativePath} should not use javascript: links`);
  }
});
