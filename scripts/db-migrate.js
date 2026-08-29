const { initializeDatabase, closeDatabase } = require('../src/main/database/connection');

initializeDatabase()
  .then(async () => {
    console.log('Database migration completed.');
    await closeDatabase();
  })
  .catch(async err => {
    console.error(err);
    await closeDatabase().catch(() => {});
    process.exit(1);
  });
