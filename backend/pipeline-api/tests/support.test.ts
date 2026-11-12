// Обращения в поддержку: схема, HTTP-контракт /support, CORS и маршрут в полном сервере.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createSupportServer } from '../src/support/server';
import { supportRequestSchema } from '../src/support/schema';
import { createPipelineServer } from '../src/server';
import { loadConfig } from '../src/config';
import type { MailMessage, MailPort } from '../src/mail/port';
import type { PipelineDeps } from '../src/pipeline/deps';

const ALLOWED_ORIGIN = 'http://localhost:5173';
const SUPPORT_EMAIL = 'test@test.com';
const validBody = { email: 'ivan@university.ru', name: 'Иван Иванов', message: 'Не могу загрузить файл' };

class RecordingMail implements MailPort {
  sent: MailMessage[] = [];
  fail = false;

  async send(message: MailMessage): Promise<void> {
    if (this.fail) throw new Error('smtp is down');
    this.sent.push(message);
  }
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function post(base: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}/support`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('схема обращения', () => {
  it('принимает корректное обращение и обрезает пробелы', () => {
    const parsed = supportRequestSchema.safeParse({ email: ' ivan@university.ru ', name: ' Иван ', message: ' Текст ' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual({ email: 'ivan@university.ru', name: 'Иван', message: 'Текст' });
  });

  it('отклоняет некорректный e-mail, пустые поля и лишние ключи', () => {
    expect(supportRequestSchema.safeParse({ ...validBody, email: 'не почта' }).success).toBe(false);
    expect(supportRequestSchema.safeParse({ ...validBody, email: 'a@b' }).success).toBe(false);
    expect(supportRequestSchema.safeParse({ ...validBody, name: '   ' }).success).toBe(false);
    expect(supportRequestSchema.safeParse({ ...validBody, message: '' }).success).toBe(false);
    expect(supportRequestSchema.safeParse({ ...validBody, extra: 1 }).success).toBe(false);
  });

  it('границы длины: имя до 200, сообщение до 2000, e-mail до 254', () => {
    expect(supportRequestSchema.safeParse({ ...validBody, name: 'я'.repeat(200) }).success).toBe(true);
    expect(supportRequestSchema.safeParse({ ...validBody, name: 'я'.repeat(201) }).success).toBe(false);
    expect(supportRequestSchema.safeParse({ ...validBody, message: 'а'.repeat(2000) }).success).toBe(true);
    expect(supportRequestSchema.safeParse({ ...validBody, message: 'а'.repeat(2001) }).success).toBe(false);
    const longEmail = `${'a'.repeat(250)}@t.ru`;
    expect(longEmail.length).toBeGreaterThan(254);
    expect(supportRequestSchema.safeParse({ ...validBody, email: longEmail }).success).toBe(false);
  });
});

describe('createSupportServer: POST /support', () => {
  let mail: RecordingMail;
  let logger: { error: ReturnType<typeof vi.fn> };
  let server: Server;
  let base: string;

  beforeEach(async () => {
    mail = new RecordingMail();
    logger = { error: vi.fn() };
    server = createSupportServer({ mail, supportEmail: SUPPORT_EMAIL, allowedOrigin: ALLOWED_ORIGIN, logger });
    base = await listen(server);
  });

  afterEach(() => close(server));

  it('корректное обращение — 200 {status:"sent"} и письмо на адрес поддержки с reply-to', async () => {
    const res = await post(base, validBody);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'sent' });

    expect(mail.sent).toHaveLength(1);
    const [message] = mail.sent;
    expect(message.to).toBe(SUPPORT_EMAIL);
    expect(message.subject).toBe('Буха: обращение в поддержку');
    expect(message.replyTo).toBe(validBody.email);
    expect(message.text).toContain('Иван Иванов');
    expect(message.text).toContain('ivan@university.ru');
    expect(message.text).toContain('Не могу загрузить файл');
  });

  it('неверная схема — 400 с деталями, письмо не отправляется', async () => {
    const res = await post(base, { ...validBody, email: 'не почта' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details: string[] };
    expect(body.error).toBe('invalid request');
    expect(body.details.some((d) => d.startsWith('email:'))).toBe(true);
    expect(mail.sent).toHaveLength(0);
  });

  it('битый JSON — 400', async () => {
    const res = await post(base, '{not json');
    expect(res.status).toBe(400);
    expect(mail.sent).toHaveLength(0);
  });

  it('слишком большое тело — 413', async () => {
    const res = await post(base, { ...validBody, message: 'а'.repeat(70_000) });
    expect(res.status).toBe(413);
    expect(mail.sent).toHaveLength(0);
  });

  it('ошибка отправки — 500, текст обращения в лог не попадает', async () => {
    mail.fail = true;
    const res = await post(base, validBody);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'mail failed' });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('Не могу загрузить файл');
  });

  it('GET /support — 405, неизвестный путь — 404, /health — 200', async () => {
    expect((await fetch(`${base}/support`)).status).toBe(405);
    expect((await fetch(`${base}/nope`)).status).toBe(404);
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });
});

describe('CORS для /support', () => {
  let mail: RecordingMail;
  let server: Server;
  let base: string;

  beforeEach(async () => {
    mail = new RecordingMail();
    server = createSupportServer({ mail, supportEmail: SUPPORT_EMAIL, allowedOrigin: ALLOWED_ORIGIN, logger: { error: vi.fn() } });
    base = await listen(server);
  });

  afterEach(() => close(server));

  it('preflight с разрешённого origin — 204 и заголовки для POST с Content-Type', async () => {
    const res = await fetch(`${base}/support`, {
      method: 'OPTIONS',
      headers: { Origin: ALLOWED_ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type');
  });

  it('чужой origin не получает Access-Control-Allow-Origin', async () => {
    const res = await post(base, validBody, { Origin: 'https://evil.example' });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('запрос с разрешённого origin получает Access-Control-Allow-Origin', async () => {
    const res = await post(base, validBody, { Origin: ALLOWED_ORIGIN });
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
  });
});

describe('маршрут /support в полном pipeline-сервере', () => {
  let mail: RecordingMail;
  let server: Server;
  let base: string;

  beforeEach(async () => {
    mail = new RecordingMail();
    // /support не обращается к deps (БД, LLM), поэтому передаём пустой объект.
    server = createPipelineServer({} as PipelineDeps, {
      sharedSecret: 'pipeline-secret',
      support: { mail, supportEmail: SUPPORT_EMAIL, allowedOrigin: ALLOWED_ORIGIN, logger: { error: vi.fn() } },
    });
    base = await listen(server);
  });

  afterEach(() => close(server));

  it('публичный: 200 без x-pipeline-secret, при этом /pipeline по-прежнему требует секрет', async () => {
    const res = await post(base, validBody);
    expect(res.status).toBe(200);
    expect(mail.sent).toHaveLength(1);

    const pipeline = await fetch(`${base}/pipeline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(pipeline.status).toBe(401);
  });

  it('400 при неверном теле', async () => {
    const res = await post(base, { email: 'x' });
    expect(res.status).toBe(400);
  });

  it('без опции support маршрут отсутствует — 404', async () => {
    const bare = createPipelineServer({} as PipelineDeps, {});
    const url = await listen(bare);
    try {
      expect((await post(url, validBody)).status).toBe(404);
    } finally {
      await close(bare);
    }
  });
});

describe('конфигурация поддержки', () => {
  it('значения по умолчанию: test@test.com, origin localhost:5173, outbox без SMTP', () => {
    const cfg = loadConfig({});
    expect(cfg.supportEmail).toBe('test@test.com');
    expect(cfg.supportAllowedOrigin).toBe('http://localhost:5173');
    expect(cfg.smtp.host).toBeUndefined();
    expect(cfg.outboxDir).toMatch(/outbox$/);
  });

  it('SUPPORT_EMAIL, SUPPORT_ALLOWED_ORIGIN и SMTP_* читаются из окружения', () => {
    const cfg = loadConfig({
      SUPPORT_EMAIL: 'help@buha.example',
      SUPPORT_ALLOWED_ORIGIN: 'https://app.example',
      SMTP_HOST: 'smtp.example',
      SMTP_PORT: '465',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
      MAIL_FROM: 'noreply@buha.example',
    });
    expect(cfg.supportEmail).toBe('help@buha.example');
    expect(cfg.supportAllowedOrigin).toBe('https://app.example');
    expect(cfg.smtp).toEqual({ host: 'smtp.example', port: 465, user: 'user', pass: 'pass', from: 'noreply@buha.example' });
  });
});
