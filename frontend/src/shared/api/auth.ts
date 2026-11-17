// Вход по коду из письма: клиент к маршрутам /auth/* бэкенда. Сессия — httpOnly cookie, фронт её не читает.
import { env } from '../config/env';

export type AuthPurpose = 'user' | 'admin';

export interface CurrentUser {
  userId: string;
  email: string;
  role: string;
}

export type AuthResult<T> = { ok: true; value: T } | { ok: false; message: string };

const FALLBACK_ERROR = 'Не удалось выполнить запрос. Попробуйте ещё раз.';

async function post(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${env.authEndpoint}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

/** Просит код на почту. Ответ одинаковый всегда (SENT), поэтому по нему нельзя понять, есть ли аккаунт. */
export async function requestCode(email: string, purpose: AuthPurpose = 'user'): Promise<AuthResult<null>> {
  try {
    const { status, json } = await post('/code/request', { email, purpose });
    if (status === 200) return { ok: true, value: null };
    return { ok: false, message: typeof json.message === 'string' ? json.message : FALLBACK_ERROR };
  } catch {
    return { ok: false, message: FALLBACK_ERROR };
  }
}

/** Подтверждает код. При успехе сервер ставит cookie сессии. */
export async function verifyCode(email: string, code: string, purpose: AuthPurpose = 'user'): Promise<AuthResult<CurrentUser>> {
  try {
    const { status, json } = await post('/code/verify', { email, code, purpose });
    if (status === 200 && json.status === 'OK') {
      return {
        ok: true,
        value: { userId: String(json.userId), email: String(json.email), role: String(json.role) },
      };
    }
    return { ok: false, message: typeof json.message === 'string' ? json.message : FALLBACK_ERROR };
  } catch {
    return { ok: false, message: FALLBACK_ERROR };
  }
}

/** Текущий пользователь по cookie сессии, или null (не вошёл). */
export async function fetchMe(): Promise<CurrentUser | null> {
  try {
    const res = await fetch(`${env.authEndpoint}/me`, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    return { userId: String(json.userId), email: String(json.email), role: String(json.role) };
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await post('/logout', {});
  } catch {
    // Сессия истечёт сама по сроку; ошибку сети здесь не показываем.
  }
}
