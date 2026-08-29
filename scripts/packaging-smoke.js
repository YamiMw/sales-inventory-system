'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const required = [
  'package.json',
  'electron-builder.yml',
  'src/main/main.js',
  'src/main/preload.js',
  'src/renderer/index.html',
  'src/renderer/login.html',
  'src/renderer/js/app.js',
  'resources/icon.ico',
  'src/renderer/assets/images/logo.png'
];

function fail(message, details = '') {
  console.error(message);
  if (details) console.error(details);
  process.exit(1);
}

function checkRequiredFiles() {
  const missing = required.filter(rel => !fs.existsSync(path.join(root, rel)));
  if (missing.length) {
    fail('Packaging smoke check failed. Missing:', missing.map(m => ` - ${m}`).join('\n'));
  }
}

function tail(value, maxLength = 4000) {
  const text = String(value || '').trim();
  return text.length > maxLength ? text.slice(-maxLength) : text;
}

function runElectronSmoke() {
  return new Promise((resolve, reject) => {
    const electronPath = require('electron');
    const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-inventory-packaging-smoke-'));
    const env = {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      SALES_INVENTORY_CONSOLE_LOGS: '0',
      SALES_INVENTORY_PACKAGING_SMOKE: '1',
      SALES_INVENTORY_USER_DATA_DIR: path.join(smokeRoot, 'profile'),
      SALES_INVENTORY_DB_PATH: path.join(smokeRoot, 'smoke.sqlite'),
      SALES_INVENTORY_LOG_DIR: path.join(smokeRoot, 'logs')
    };

    let stdout = '';
    let stderr = '';
    const child = spawn(electronPath, ['.'], {
      cwd: root,
      env,
      windowsHide: true
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Electron packaging smoke check timed out.'));
    }, 30000);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      fs.rmSync(smokeRoot, { recursive: true, force: true });

      const marker = stdout.match(/PACKAGING_SMOKE_OK\s+({.+})/);
      if (code !== 0 || !marker) {
        reject(new Error([
          `Electron exited with ${signal || `code ${code}`}.`,
          tail(stdout),
          tail(stderr)
        ].filter(Boolean).join('\n')));
        return;
      }

      try {
        resolve(JSON.parse(marker[1]));
      } catch (error) {
        reject(new Error(`Invalid smoke marker: ${error.message}`));
      }
    });
  });
}

(async () => {
  checkRequiredFiles();
  try {
    const result = await runElectronSmoke();
    console.log(
      `Packaging smoke check passed. Electron ${result.electron}, SQLite ${result.sqlite}, ABI ${result.abi}.`
    );
  } catch (error) {
    fail('Packaging smoke check failed.', error.message);
  }
})();
