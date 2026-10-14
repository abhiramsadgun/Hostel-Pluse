const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

let poolInstance = null;
let isInMemoryFallback = false;

async function initDb() {
  if (poolInstance) return poolInstance;

  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hostelpulse';
  
  // Try real PostgreSQL connection
  const realPool = new Pool({
    connectionString,
    connectionTimeoutMillis: 2000, // 2s quick probe
  });

  try {
    const client = await realPool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('[DB] Connected to PostgreSQL at', connectionString.split('@')[1] || connectionString);
    poolInstance = realPool;
    isInMemoryFallback = false;
    return poolInstance;
  } catch (err) {
    console.warn(`[DB] Notice: Could not connect to external PostgreSQL (${err.message}).`);
    console.log('[DB] Activating in-memory PostgreSQL emulator (pg-mem) for instant zero-config operation...');
    
    const { newDb } = require('pg-mem');
    const memDb = newDb();

    // Register PostgreSQL functions used in timestamps/json
    memDb.public.registerFunction({
      name: 'version',
      implementation: () => 'PostgreSQL 15.0 (pg-mem emulation for HostelPulse)',
    });

    const pgAdapter = memDb.adapters.createPg();
    poolInstance = new pgAdapter.Pool();
    isInMemoryFallback = true;

    // Run migrations into in-memory instance automatically
    await runMigrationsInternal(poolInstance);

    // Auto-seed demo personas and menus in in-memory mode for out-of-the-box readiness
    try {
      const { seed } = require('./seed');
      await seed();
    } catch (sErr) {
      console.warn('[DB] Auto-seed warning:', sErr.message);
    }

    return poolInstance;
  }
}

async function runMigrationsInternal(pool) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      // Split on statements or execute directly
      await pool.query(sql);
      console.log(`[DB] Migrated: ${file}`);
    } catch (migErr) {
      console.error(`[DB] Error executing migration ${file}:`, migErr.message);
      throw migErr;
    }
  }
}

async function query(text, params) {
  if (!poolInstance) {
    await initDb();
  }
  return poolInstance.query(text, params);
}

async function getClient() {
  if (!poolInstance) {
    await initDb();
  }
  return poolInstance.connect();
}

async function runMigrations() {
  const pool = await initDb();
  if (!isInMemoryFallback) {
    await runMigrationsInternal(pool);
  }
  return true;
}

module.exports = {
  initDb,
  query,
  getClient,
  runMigrations,
  getIsInMemory: () => isInMemoryFallback,
};
