const { initDb, runMigrations } = require('./index');

async function main() {
  console.log('[MIGRATE] Initializing database and running migrations...');
  try {
    await initDb();
    await runMigrations();
    console.log('[MIGRATE] All migrations applied successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATE] Migration failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
