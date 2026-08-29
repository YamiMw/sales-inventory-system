/**
 * Create Database Snapshot
 * Creates a portable snapshot of the current application database.
 */

const fs = require('node:fs');
const path = require('node:path');
const knex = require('knex');

const sourcePath = path.resolve(process.argv[2] || '');
const destinationPath = path.resolve(process.argv[3] || '');

if (!process.argv[2] || !process.argv[3]) {
  throw new Error(
    'Usage: node create-database-snapshot.js <source-database> <destination-database>'
  );
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source database does not exist: ${sourcePath}`);
  }
  if (fs.existsSync(destinationPath)) {
    throw new Error(`Snapshot destination already exists: ${destinationPath}`);
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

  const source = knex({
    client: 'better-sqlite3',
    connection: { filename: sourcePath },
    useNullAsDefault: true
  });

  try {
    const sourceIntegrity = await source.raw('PRAGMA integrity_check');
    await source.raw('VACUUM INTO ?', [destinationPath]);

    const snapshot = knex({
      client: 'better-sqlite3',
      connection: { filename: destinationPath },
      useNullAsDefault: true
    });

    try {
      const snapshotIntegrity = await snapshot.raw('PRAGMA integrity_check');
      const customerCount = await snapshot('customers').count('* as count').first();

      process.stdout.write(`${JSON.stringify({
        sourcePath,
        destinationPath,
        size: fs.statSync(destinationPath).size,
        sourceIntegrity: sourceIntegrity[0]?.integrity_check,
        snapshotIntegrity: snapshotIntegrity[0]?.integrity_check,
        customerCount: Number(customerCount.count)
      }, null, 2)}\n`);
    } finally {
      await snapshot.destroy();
    }
  } catch (error) {
    if (fs.existsSync(destinationPath)) {
      fs.rmSync(destinationPath, { force: true });
    }
    throw error;
  } finally {
    await source.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
