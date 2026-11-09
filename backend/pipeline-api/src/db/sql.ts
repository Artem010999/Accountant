// Тонкая абстракция над драйвером Postgres: pg (продакшн / Supabase) и PGlite (тесты) — один и тот же SQL.

export interface SqlClient {
  /** Параметризованный запрос ($1, $2 ...). */
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
  /** Несколько операторов без параметров (миграции). */
  exec(text: string): Promise<unknown>;
}

export function fromPgPool(pool: { query: (...args: any[]) => Promise<any> }): SqlClient {
  return {
    query: (text, params) => pool.query(text, params ?? []),
    exec: (text) => pool.query(text),
  };
}

export function fromPglite(db: {
  query: (text: string, params?: unknown[]) => Promise<any>;
  exec: (text: string) => Promise<any>;
}): SqlClient {
  return {
    query: (text, params) => db.query(text, params ?? []),
    exec: (text) => db.exec(text),
  };
}

/** Формат pgvector: '[0.1,0.2,...]'. */
export const toVectorLiteral = (v: number[]): string => `[${v.join(',')}]`;
