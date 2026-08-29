'use strict';

function describeRuntime() {
  if (process.versions.electron) {
    return `Electron ${process.versions.electron} (ABI ${process.versions.modules})`;
  }

  return `Node ${process.versions.node} (ABI ${process.versions.modules})`;
}

try {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  const { version } = db.prepare('select sqlite_version() as version').get();
  db.close();

  console.log(`better-sqlite3 native binding loaded in ${describeRuntime()}.`);
  console.log(`SQLite ${version} is available.`);
} catch (error) {
  console.error(`better-sqlite3 native binding could not be loaded in ${describeRuntime()}.`);
  console.error('Rebuild it for the runtime you are about to use:');
  console.error('  Node tests: npm run rebuild:node');
  console.error('  Electron app: npm run rebuild:electron');
  console.error(error.message);
  process.exit(1);
}
