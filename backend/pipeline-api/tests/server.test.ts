// HTTP-контракт: валидация, секрет, коды ответов.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createPipelineServer } from '../src/server';
import { createTestDb, createUser, makeDeps, type TestDb } from './helpers';

let db: TestDb;
let server: Server;
let base: string;
const SECRET = 'test-secret';

beforeAll(async () => {
  db = await createTestDb();
  server = createPipelineServer(makeDeps(db), { sharedSecret: SECRET });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (body: unknown, headers: Record<string, string> = { 'x-pipeline-secret': SECRET }) =>
  fetch(`${base}/pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('HTTP /pipeline', () => {
  it('health без секрета', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
  });

  it('без секрета — 401', async () => {
    const res = await post({}, {});
    expect(res.status).toBe(401);
  });

  it('битый JSON — 400', async () => {
    const res = await post('{not json');
    expect(res.status).toBe(400);
  });

  it('неверная схема запроса — 400 с деталями', async () => {
    const res = await post({ user_id: 'not-a-uuid', action: 'nope' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { details: string[] };
    expect(body.details.length).toBeGreaterThan(0);
  });

  it('несуществующий пользователь — 422 USER_BANNED', async () => {
    const res = await post({ user_id: randomUUID(), action: 'init_or_upload', program: 'Студенческий стартап', text_input: 'x' });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe('USER_BANNED');
  });

  it('холодный старт — 200 WAITING_FOR_INITIAL_BRIEF', async () => {
    const userId = await createUser(db.sql);
    const res = await post({ user_id: userId, action: 'init_or_upload', program: 'Студенческий стартап', eligibility: PASSING_ELIGIBILITY });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe('WAITING_FOR_INITIAL_BRIEF');
  });

  it('без анкеты допуска — 200 ELIGIBILITY_REQUIRED со списком вопросов', async () => {
    const userId = await createUser(db.sql);
    const res = await post({ user_id: userId, action: 'init_or_upload', program: 'Студенческий стартап' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; questions: { key: string }[] };
    expect(body.status).toBe('ELIGIBILITY_REQUIRED');
    expect(body.questions.length).toBe(4);
  });

  it('схема принимает submit_form с полями, сметой и анкетой', async () => {
    const res = await post({
      user_id: randomUUID(),
      action: 'submit_form',
      program: 'Студенческий стартап',
      eligibility: PASSING_ELIGIBILITY,
      form: [{ section_id: 4, field_key: 'direction', value: 'Н1' }],
      budget_items: [{ stage: 1, category: 'other', title: 'Консультации', quantity: 1, unit_price: 20000, amount: 20000 }],
    });
    // Схема пройдена: дальше запрос уходит в обработчик (здесь — пользователь не существует).
    expect(res.status).not.toBe(400);
  });

  it('схема отклоняет неизвестную категорию сметы', async () => {
    const res = await post({
      user_id: randomUUID(),
      action: 'submit_form',
      program: 'Студенческий стартап',
      budget_items: [{ stage: 1, category: 'bribe', title: 'x', quantity: 1, unit_price: 1, amount: 1 }],
    });
    expect(res.status).toBe(400);
  });
});

const PASSING_ELIGIBILITY = {
  is_student_or_postgraduate: true,
  has_open_fsi_contracts_or_applications: false,
  has_prior_student_startup_grant: false,
  ready_to_open_llc_after_win: true,
};
