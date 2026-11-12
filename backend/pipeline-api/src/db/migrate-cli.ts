// Запуск: SUPABASE_DB_URL=postgres://... DEV_SEED=1 npm run migrate -w @passport/pipeline-api
// Если схема уже есть (таблица app_projects существует), миграции пропускаются:
// повторный `docker compose up` не должен падать. Принудительно: FORCE_MIGRATE=1 (тогда упадёт на существующих объектах).
import pg from 'pg';
import { loadConfig, SUPABASE_DIR } from '../config';
import { applyMigrations } from './migrate';
import { fromPgPool, type SqlClient } from './sql';

const { Pool } = pg;

export async function isSchemaPresent(sql: SqlClient): Promise<boolean> {
  const { rows } = await sql.query("SELECT to_regclass('public.app_projects') AS t");
  return rows[0]?.t !== null && rows[0]?.t !== undefined;
}

async function main() {
  const cfg = loadConfig();
  if (!cfg.databaseUrl) throw new Error('Задайте SUPABASE_DB_URL или DATABASE_URL');
  const pool = new Pool({ connectionString: cfg.databaseUrl });
  try {
    const sql = fromPgPool(pool);
    if (process.env.FORCE_MIGRATE !== '1' && (await isSchemaPresent(sql))) {
      console.log('Schema already present (app_projects exists): migrations skipped.');
      return;
    }
    const result = await applyMigrations(sql, SUPABASE_DIR, { devSeed: process.env.DEV_SEED === '1' });
    console.log('Applied:', result);
  } finally {
    await pool.end();
  }
}

// Запуск как CLI, а не при импорте в тестах.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrate-cli.ts')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
