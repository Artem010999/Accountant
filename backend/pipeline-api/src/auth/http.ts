// HTTP-маршруты входа: POST /auth/code/request, POST /auth/code/verify, GET /auth/me, POST /auth/logout.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SESSION_TTL_MS, type AuthPurpose, type AuthService, type AuthUser } from './service';

export const SESSION_COOKIE = 'buha_session';
const MAX_BODY_BYTES = 10_000;

export interface AuthHttpOptions {
  service: AuthService;
  /** Cookie только по HTTPS (AUTH_COOKIE_SECURE=false — только для локальной разработки по http). */
  cookieSecure: boolean;
}

const VERIFY_ERRORS: Record<string, { status: number; message: string }> = {
  INVALID_EMAIL: { status: 400, message: 'Проверьте адрес электронной почты' },
  INVALID_CODE: { status: 400, message: 'Неверный код' },
  CODE_EXPIRED: { status: 400, message: 'Код истёк. Запросите новый' },
  TOO_MANY_ATTEMPTS: { status: 429, message: 'Слишком много попыток. Запросите новый код' },
  NOT_ADMIN: { status: 403, message: 'Доступ запрещён' },
  BANNED: { status: 403, message: 'Доступ ограничен' },
};

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string | string[]> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  let size = 0;
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > MAX_BODY_BYTES) return null;
      chunks.push(chunk as Buffer);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Пользователь текущей сессии (cookie) или null. Используется защищёнными маршрутами. */
export async function sessionUserFor(req: IncomingMessage, opts: AuthHttpOptions): Promise<AuthUser | null> {
  const token = sessionTokenFrom(req);
  return token ? opts.service.userForToken(token) : null;
}

export function sessionTokenFrom(req: IncomingMessage): string | null {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE && rest.length > 0) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function sessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearCookie(secure: boolean): string {
  return sessionCookie('', secure).replace(/Max-Age=\d+/, 'Max-Age=0');
}

function purposeFrom(body: Record<string, unknown>): AuthPurpose | null {
  const p = body.purpose ?? 'user';
  return p === 'user' || p === 'admin' ? p : null;
}

/** Обрабатывает /auth/*. Возвращает false, если путь не относится к входу. */
export async function handleAuthRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  opts: AuthHttpOptions,
): Promise<boolean> {
  const { service, cookieSecure } = opts;

  if (req.method === 'POST' && pathname === '/auth/code/request') {
    const body = await readBody(req);
    const purpose = body ? purposeFrom(body) : null;
    if (!body || typeof body.email !== 'string' || !purpose) {
      send(res, 400, { status: 'ERROR', code: 'INVALID_REQUEST', message: 'Укажите email' });
      return true;
    }
    const result = await service.requestCode(body.email, purpose);
    if (result === 'INVALID_EMAIL') {
      send(res, 400, { status: 'ERROR', code: 'INVALID_EMAIL', message: VERIFY_ERRORS.INVALID_EMAIL.message });
      return true;
    }
    send(res, 200, { status: 'SENT' });
    return true;
  }

  if (req.method === 'POST' && pathname === '/auth/code/verify') {
    const body = await readBody(req);
    const purpose = body ? purposeFrom(body) : null;
    if (!body || typeof body.email !== 'string' || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code) || !purpose) {
      send(res, 400, { status: 'ERROR', code: 'INVALID_CODE', message: VERIFY_ERRORS.INVALID_CODE.message });
      return true;
    }
    const result = await service.verifyCode(body.email, body.code, purpose);
    if (!result.ok) {
      const err = VERIFY_ERRORS[result.code] ?? { status: 400, message: 'Не удалось войти' };
      send(res, err.status, { status: 'ERROR', code: result.code, message: err.message });
      return true;
    }
    send(
      res,
      200,
      { status: 'OK', userId: result.userId, email: result.email, role: result.role },
      { 'Set-Cookie': sessionCookie(result.token, cookieSecure) },
    );
    return true;
  }

  if (req.method === 'GET' && pathname === '/auth/me') {
    const token = sessionTokenFrom(req);
    const user = token ? await service.userForToken(token) : null;
    if (!user) return send(res, 401, { status: 'UNAUTHORIZED' }), true;
    send(res, 200, { status: 'OK', userId: user.userId, email: user.email, role: user.role });
    return true;
  }

  if (req.method === 'POST' && pathname === '/auth/logout') {
    const token = sessionTokenFrom(req);
    if (token) await service.logout(token);
    send(res, 200, { status: 'OK' }, { 'Set-Cookie': clearCookie(cookieSecure) });
    return true;
  }

  return false;
}
