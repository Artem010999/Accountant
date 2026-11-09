// Запуск: DATABASE_URL=postgres://... DEV_SEED=1 npm run migrate -w @passport/pipeline-api
import pg from 'pg';
import { loadConfig, SUPABASE_DIR } from '../config';
import { applyMigrations } from './migrate';
import { fromPgPool } from './sql';

const { Pool } = pg;

async function main() {
  const cfg = loadConfig();
  if (!cfg.databaseUrl) throw new Error('Задайте SUPABASE_DB_URL или DATABASE_URL');
  const pool = new Pool({ connectionString: cfg.databaseUrl });
  try {
    const result = await applyMigrations(fromPgPool(pool), SUPABASE_DIR, { devSeed: process.env.DEV_SEED === '1' });
    console.log('Applied:', result);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
