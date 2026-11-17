// Вход и регистрация по коду: аккаунт создаётся при первом подтверждении, админ — только существующий admin.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPipelineServer } from '../src/server';
import { AuthService, CODE_COOLDOWN_MS } from '../src/auth/service';
import type { MailMessage, MailPort } from '../src/mail/port';
import { createTestDb, makeDeps, type TestDb } from './helpers';

class CaptureMail implements MailPort {
  sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
  lastCode(): string {
    const m = this.sent.at(-1)?.text.match(/Ваш код: (\d{6})/);
    if (!m) throw new Error('код не найден в письме');
    return m[1]!;
  }
}

let db: TestDb;
let mail: CaptureMail;
let auth: AuthService;
let base: string;
let stop: () => Promise<void>;
let clock: { now: Date };

beforeAll(async () => {
  db = await createTestDb();
  clock = { now: new Date('2026-11-17T10:00:00Z') };
  mail = new CaptureMail();
  auth = new AuthService(db.sql, mail, 'test-auth-secret', () => clock.now);
  const server = createPipelineServer(makeDeps(db), { auth: { service: auth, cookieSecure: false } });
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  stop = () => new Promise<void>((r) => server.close(() => r()));
});

afterAll(async () => {
  await stop();
});

beforeEach(async () => {
  mail.sent = [];
  clock.now = new Date('2026-11-17T10:00:00Z');
  await db.sql.query('DELETE FROM auth_codes');
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

// Сдвиг часов больше cooldown, чтобы можно было запросить следующий код.
const later = (ms: number) => (clock.now = new Date(clock.now.getTime() + ms));

describe('вход по коду: регистрация и вход пользователя', () => {
  it('новый email: код уходит на почту, после подтверждения создаётся аккаунт и сессия', async () => {
    const email = 'new.student@example.com';
    expect((await post('/auth/code/request', { email })).status).toBe(200);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]!.to).toBe(email);

    const res = await post('/auth/code/verify', { email, code: mail.lastCode() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; role: string; email: string; userId: string };
    expect(body).toMatchObject({ status: 'OK', role: 'user', email });
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^buha_session=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000/);

    const { rows } = await db.sql.query('SELECT role, email FROM app_profiles WHERE id = $1::uuid', [body.userId]);
    expect(rows[0]).toMatchObject({ role: 'user', email });
  });

  it('cookie сессии открывает /auth/me, без неё — 401; после выхода сессия закрыта', async () => {
    const email = 'session.user@example.com';
    await post('/auth/code/request', { email });
    const verify = await post('/auth/code/verify', { email, code: mail.lastCode() });
    const cookie = verify.headers.get('set-cookie')!.split(';')[0]!;

    const me = await fetch(`${base}/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ status: 'OK', email, role: 'user' });

    expect((await fetch(`${base}/auth/me`)).status).toBe(401);

    await post('/auth/logout', {}, { cookie });
    expect((await fetch(`${base}/auth/me`, { headers: { cookie } })).status).toBe(401);
  });

  it('неверный код: 400, после 5 попыток — 429 и код больше не принимается', async () => {
    const email = 'brute@example.com';
    await post('/auth/code/request', { email });
    const real = mail.lastCode();
    const wrong = real === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i++) {
      const res = await post('/auth/code/verify', { email, code: wrong });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: 'INVALID_CODE' });
    }
    const blocked = await post('/auth/code/verify', { email, code: real });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
  });

  it('просроченный код не принимается', async () => {
    const email = 'late@example.com';
    await post('/auth/code/request', { email });
    const code = mail.lastCode();
    later(11 * 60 * 1000);
    const res = await post('/auth/code/verify', { email, code });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'CODE_EXPIRED' });
  });

  it('повторный запрос раньше cooldown не отправляет второе письмо', async () => {
    const email = 'spam@example.com';
    await post('/auth/code/request', { email });
    await post('/auth/code/request', { email });
    expect(mail.sent).toHaveLength(1);
    later(CODE_COOLDOWN_MS + 1000);
    await post('/auth/code/request', { email });
    expect(mail.sent).toHaveLength(2);
  });

  it('неверный формат email — 400, код не отправляется', async () => {
    const res = await post('/auth/code/request', { email: 'не почта' });
    expect(res.status).toBe(400);
    expect(mail.sent).toHaveLength(0);
  });
});

describe('вход администратора: только существующий admin, создать админа через API нельзя', () => {
  it('для обычного пользователя код admin не отправляется и аккаунт не появляется', async () => {
    const res = await post('/auth/code/request', { email: 'intruder@example.com', purpose: 'admin' });
    expect(res.status).toBe(200);
    expect(mail.sent).toHaveLength(0);
    const verify = await post('/auth/code/verify', { email: 'intruder@example.com', code: '123456', purpose: 'admin' });
    expect(verify.status).toBe(400);
    const { rows } = await db.sql.query("SELECT 1 FROM app_profiles WHERE email = 'intruder@example.com'");
    expect(rows).toHaveLength(0);
  });

  it('админ (роль выдана вручную в БД) получает код admin и входит', async () => {
    const email = 'boss@example.com';
    await post('/auth/code/request', { email }); // сначала регистрируется как обычный пользователь
    await post('/auth/code/verify', { email, code: mail.lastCode() });
    await db.sql.query("UPDATE app_profiles SET role = 'admin' WHERE email = $1", [email]); // ручное назначение

    mail.sent = [];
    later(CODE_COOLDOWN_MS + 1000);
    expect((await post('/auth/code/request', { email, purpose: 'admin' })).status).toBe(200);
    expect(mail.sent).toHaveLength(1);

    const res = await post('/auth/code/verify', { email, code: mail.lastCode(), purpose: 'admin' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'OK', role: 'admin' });
  });

  it('код пользователя нельзя использовать для входа админа (purpose разделён)', async () => {
    const email = 'split@example.com';
    await post('/auth/code/request', { email });
    await post('/auth/code/verify', { email, code: mail.lastCode() });
    await db.sql.query("UPDATE app_profiles SET role = 'admin' WHERE email = $1", [email]);

    await post('/auth/code/request', { email }); // код для purpose=user — не вход админа
    later(CODE_COOLDOWN_MS + 1000);
    const res = await post('/auth/code/verify', { email, code: mail.lastCode(), purpose: 'admin' });
    expect(res.status).toBe(400); // нет кода для purpose=admin
  });

  it('роль нельзя поднять через пользовательские маршруты', async () => {
    const email = 'escalate@example.com';
    await post('/auth/code/request', { email });
    const verify = await post('/auth/code/verify', { email, code: mail.lastCode() });
    const cookie = verify.headers.get('set-cookie')!.split(';')[0]!;
    // Тело запроса профиля не должно влиять на роль: маршрута для смены роли нет вовсе.
    const res = await post('/profile', { user_id: (await verify.json() as { userId: string }).userId, role: 'admin', founder: { full_name: 'Иван' } }, { cookie });
    expect(res.status).not.toBe(500);
    const { rows } = await db.sql.query('SELECT role FROM app_profiles WHERE email = $1', [email]);
    expect(rows[0]?.role).toBe('user');
  });
});

describe('защита маршрутов сессией: user_id берётся из входа, а не из запроса', () => {
  // Вход пользователя по коду: возвращает cookie сессии и id аккаунта.
  async function login(email: string): Promise<{ cookie: string; userId: string }> {
    await post('/auth/code/request', { email });
    const res = await post('/auth/code/verify', { email, code: mail.lastCode() });
    const body = (await res.json()) as { userId: string };
    return { cookie: res.headers.get('set-cookie')!.split(';')[0]!, userId: body.userId };
  }

  it('без сессии профиль, пайплайн, экспорт и чат отвечают 401', async () => {
    const someone = '00000000-0000-4000-8000-000000000001';
    expect((await post('/profile', { user_id: someone, founder: { full_name: 'Иван' } })).status).toBe(401);
    expect((await post('/pipeline', { user_id: someone, action: 'init_or_upload', program: 'Студенческий стартап' })).status).toBe(401);
    expect((await post('/export', { user_id: someone, sections: [] })).status).toBe(401);
    expect((await fetch(`${base}/chat?user_id=${someone}`)).status).toBe(401);
  });

  it('профиль с сессией пишется только в аккаунт владельца, подмена user_id в теле игнорируется', async () => {
    const alice = await login('alice.protect@example.com');
    const bob = await login('bob.protect@example.com');

    const res = await post(
      '/profile',
      { user_id: bob.userId, founder: { full_name: 'Алиса Петрова' } },
      { cookie: alice.cookie },
    );
    expect(res.status).toBe(200);

    const { rows } = await db.sql.query(
      'SELECT id, founder_data FROM app_profiles WHERE id IN ($1::uuid, $2::uuid)',
      [alice.userId, bob.userId],
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.founder_data]));
    expect(byId[alice.userId]).toMatchObject({ full_name: 'Алиса Петрова' });
    expect(byId[bob.userId]?.full_name).toBeUndefined();
  });

  it('чат с сессией отдаёт историю владельца сессии, а не user_id из query', async () => {
    const carol = await login('carol.protect@example.com');
    const dave = await login('dave.protect@example.com');
    const res = await fetch(`${base}/chat?user_id=${dave.userId}`, { headers: { cookie: carol.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { messages?: unknown[] };
    expect(body).toBeDefined();
    expect(Array.isArray(body.messages) ? body.messages.length : 0).toBe(0);
  });
});
