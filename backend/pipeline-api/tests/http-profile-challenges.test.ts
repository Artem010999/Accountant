// HTTP-маршруты фронтенда: GET /challenges (справочник вызовов) и POST /profile (данные основателя, блок 1).
import { beforeAll, describe, expect, it } from 'vitest';
import { createPipelineServer } from '../src/server';
import { createTestDb, createUser, makeDeps, type TestDb } from './helpers';

const SECRET = 'test-secret';
let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

async function withServer<T>(run: (base: string, deps: ReturnType<typeof makeDeps>) => Promise<T>): Promise<T> {
  const deps = makeDeps(db);
  const server = createPipelineServer(deps, { sharedSecret: SECRET });
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    return await run(base, deps);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

describe('HTTP: GET /challenges', () => {
  it('отдаёт справочник без секрета, только публичные поля вызова', async () => {
    await withServer(async (base, deps) => {
      const res = await fetch(`${base}/challenges`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { challenges: Record<string, unknown>[] };
      expect(body.challenges.length).toBe(deps.kb.tech_challenges.length);
      expect(body.challenges.length).toBeGreaterThan(0);
      for (const c of body.challenges) {
        expect(Object.keys(c).sort()).toEqual(['direction', 'number', 'partner', 'topic']);
      }
    });
  });
});

describe('HTTP: POST /profile', () => {
  const headers = { 'x-pipeline-secret': SECRET, 'Content-Type': 'application/json' };

  it('без секрета — 401', async () => {
    await withServer(async (base) => {
      const userId = await createUser(db.sql);
      const res = await fetch(`${base}/profile`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, founder: { full_name: 'Иванов Иван' } }),
      });
      expect(res.status).toBe(401);
    });
  });

  it('без ФИО — 400 с перечнем ошибок, в БД ничего не пишется', async () => {
    await withServer(async (base) => {
      const userId = await createUser(db.sql);
      const res = await fetch(`${base}/profile`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId, founder: { contacts: '+7 900' } }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { details: string[] };
      expect(body.details.some((d) => d.includes('full_name'))).toBe(true);
    });
  });

  it('неизвестный пользователь — 422 USER_BANNED, без записи', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/profile`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: '00000000-0000-4000-8000-000000000000', founder: { full_name: 'Иванов Иван' } }),
      });
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ status: 'ERROR', code: 'USER_BANNED' });
    });
  });

  it('валидные данные — 200 и запись в founder_data пользователя', async () => {
    await withServer(async (base) => {
      const userId = await createUser(db.sql);
      const res = await fetch(`${base}/profile`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          founder: { full_name: 'Петрова Мария Сергеевна', university: 'СамГТУ', education_status: 'student' },
        }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'OK' });
      const { rows } = await db.sql.query('SELECT founder_data FROM app_profiles WHERE id = $1::uuid', [userId]);
      const founder = (rows[0] as { founder_data: Record<string, string> } | undefined)?.founder_data;
      expect(founder).toMatchObject({ full_name: 'Петрова Мария Сергеевна', university: 'СамГТУ', education_status: 'student' });
    });
  });
});
