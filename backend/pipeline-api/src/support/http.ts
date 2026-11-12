// HTTP-обработчик POST /support. Эндпоинт публичный: его вызывает браузер, поэтому без x-pipeline-secret.
// Защита — валидация тела, лимит размера и CORS только для одного origin фронтенда.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MailPort } from '../mail/port';
import { buildSupportMail } from './compose';
import { supportRequestSchema } from './schema';

export const SUPPORT_PATH = '/support';
const MAX_BODY_BYTES = 64_000;

export interface SupportOptions {
  mail: MailPort;
  /** Адрес, на который приходят обращения (SUPPORT_EMAIL). */
  supportEmail: string;
  /** Единственный origin фронтенда, которому разрешён CORS (SUPPORT_ALLOWED_ORIGIN). */
  allowedOrigin: string;
  logger?: Pick<Console, 'error'>;
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

class PayloadTooLargeError extends Error {}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  let tooLarge = false;
  const chunks: Buffer[] = [];
  // Тело дочитываем до конца (без накопления), чтобы клиент получил ответ 413, а не обрыв соединения.
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      tooLarge = true;
      continue;
    }
    chunks.push(chunk as Buffer);
  }
  if (tooLarge) throw new PayloadTooLargeError('payload too large');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// Заголовки CORS выставляем только для разрешённого origin; для чужих сайтов Access-Control-Allow-Origin не отдаём.
function applyCors(req: IncomingMessage, res: ServerResponse, allowedOrigin: string): void {
  res.setHeader('Vary', 'Origin');
  if (req.headers.origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

export async function handleSupportRequest(req: IncomingMessage, res: ServerResponse, opts: SupportOptions): Promise<void> {
  applyCors(req, res, opts.allowedOrigin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    sendJson(res, 405, { error: 'method not allowed' });
    return;
  }

  let body: unknown;
  try {
    body = await readJson(req);
  } catch (err) {
    if (err instanceof PayloadTooLargeError) {
      sendJson(res, 413, { error: 'payload too large' });
      return;
    }
    sendJson(res, 400, { error: 'invalid json' });
    return;
  }

  const parsed = supportRequestSchema.safeParse(body);
  if (!parsed.success) {
    sendJson(res, 400, {
      error: 'invalid request',
      details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }

  try {
    await opts.mail.send(buildSupportMail(parsed.data, opts.supportEmail));
  } catch (err) {
    // Текст обращения в лог не пишем: в нём могут быть персональные данные.
    (opts.logger ?? console).error('[support] mail send failed', err instanceof Error ? err.message : err);
    sendJson(res, 500, { error: 'mail failed' });
    return;
  }

  sendJson(res, 200, { status: 'sent' });
}
