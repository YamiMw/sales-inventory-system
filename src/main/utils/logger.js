/**
 * Logger
 * Writes structured application diagnostics to console and log files.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const appDataPath = process.env.APPDATA ||
  (process.platform === 'darwin'
    ? path.join(process.env.HOME || os.homedir(), 'Library', 'Application Support')
    : path.join(process.env.HOME || os.homedir(), '.local', 'share'));

function resolveLogFile() {
  const candidates = [
    process.env.SALES_INVENTORY_LOG_DIR,
    path.join(appDataPath, 'SalesInventorySystem', 'logs'),
    path.join(os.tmpdir(), 'SalesInventorySystem', 'logs')
  ].filter(Boolean);

  for (const directory of candidates) {
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.accessSync(directory, fs.constants.W_OK);
      return path.join(directory, 'app.log');
    } catch {
      // Try the next writable location.
    }
  }
  return null;
}

const logFile = resolveLogFile();
const verboseConsole = process.env.NODE_ENV === 'development' ||
  ['1', 'true', 'yes'].includes(String(process.env.SALES_INVENTORY_CONSOLE_LOGS || '').toLowerCase());

function write(level, args, output, options = {}) {
  const timestamp = new Date().toISOString();
  const message = args.map(value =>
    value instanceof Error ? value.stack || value.message : String(value)
  ).join(' ');
  const line = `[${level}] ${timestamp} - ${message}`;
  if (options.alwaysConsole || verboseConsole) {
    output(line);
  }
  if (!logFile) return;
  try {
    fs.appendFileSync(logFile, `${line}\n`);
  } catch {
    // Console logging remains available if persistent logging fails.
  }
}

module.exports = {
  info: (...args) => write('INFO', args, console.log),
  error: (...args) => write('ERROR', args, console.error, { alwaysConsole: true }),
  warn: (...args) => write('WARN', args, console.warn, { alwaysConsole: true }),
  debug: (...args) => {
    if (verboseConsole) {
      write('DEBUG', args, console.debug, { alwaysConsole: true });
    }
  }
};
