// Вход и регистрация по коду из письма. Пароли не используются.
// Пользователь: email → 6-значный код → аккаунт создаётся при первом подтверждении.
// Админ: только существующий аккаунт с role = 'admin' (роль выдаётся вручную в БД, через API её нельзя поменять).
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { SqlClient } from '../db/sql';
import type { MailPort } from '../mail/port';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_COOLDOWN_MS = 60 * 1000;
export const CODES_PER_HOUR = 5;
export const MAX_CODE_ATTEMPTS = 5;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AuthPurpose = 'user' | 'admin';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

export type VerifyResult =
  | ({ ok: true; token: string } & AuthUser)
  | { ok: false; code: 'INVALID_EMAIL' | 'INVALID_CODE' | 'CODE_EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'NOT_ADMIN' | 'BANNED' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export class AuthService {
  constructor(
    private readonly sql: SqlClient,
    private readonly mail: MailPort,
    /** Секрет для HMAC кодов (AUTH_SECRET). Без него коды не выдаются. */
    private readonly secret: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (!secret) throw new Error('Задайте AUTH_SECRET для входа по коду');
  }

  private codeHash(email: string, purpose: AuthPurpose, code: string): string {
    return createHmac('sha256', this.secret).update(`${email}|${purpose}|${code}`).digest('hex');
  }

  /**
   * Отправляет код. Всегда отвечает одинаково (SENT), чтобы не раскрывать, есть ли аккаунт и не спам ли это:
   * при превышении лимитов или для неизвестного админа письмо просто не уходит.
   */
  async requestCode(rawEmail: string, purpose: AuthPurpose): Promise<'SENT' | 'INVALID_EMAIL'> {
    const email = normalizeEmail(rawEmail);
    if (!email) return 'INVALID_EMAIL';
    const now = this.now();

    const hourly = await this.sql.query(
      `SELECT count(*)::int AS n FROM auth_codes WHERE email = $1 AND created_at > $2::timestamptz`,
      [email, new Date(now.getTime() - 60 * 60 * 1000).toISOString()],
    );
    if (Number(hourly.rows[0]?.n ?? 0) >= CODES_PER_HOUR) return 'SENT';

    const last = await this.sql.query(
      `SELECT created_at FROM auth_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      [email],
    );
    const lastAt = last.rows[0]?.created_at ? new Date(last.rows[0].created_at).getTime() : 0;
    if (now.getTime() - lastAt < CODE_COOLDOWN_MS) return 'SENT';

    if (purpose === 'admin') {
      const admin = await this.sql.query(
        `SELECT 1 FROM app_profiles WHERE email = $1 AND role = 'admin' AND is_banned = false`,
        [email],
      );
      if (admin.rows.length === 0) return 'SENT';
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    // created_at пишем из того же источника времени, что и проверки (this.now), а не из now() базы.
    await this.sql.query(
      `INSERT INTO auth_codes (email, purpose, code_hash, expires_at, created_at) VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz)`,
      [
        email,
        purpose,
        this.codeHash(email, purpose, code),
        new Date(now.getTime() + CODE_TTL_MS).toISOString(),
        now.toISOString(),
      ],
    );
    await this.mail.send({
      to: email,
      subject: 'Код входа в «Буху»',
      text: `Ваш код: ${code}\n\nКод действует 10 минут. Если вы его не запрашивали, просто проигнорируйте письмо.`,
    });
    return 'SENT';
  }

  /** Проверяет код; при успехе создаёт аккаунт (для user, если его нет) и сессию. */
  async verifyCode(rawEmail: string, code: string, purpose: AuthPurpose): Promise<VerifyResult> {
    const email = normalizeEmail(rawEmail);
    if (!email) return { ok: false, code: 'INVALID_EMAIL' };
    const now = this.now();

    const found = await this.sql.query(
      `SELECT id, code_hash, expires_at, attempts FROM auth_codes
        WHERE email = $1 AND purpose = $2 AND consumed = false
        ORDER BY created_at DESC LIMIT 1`,
      [email, purpose],
    );
    const row = found.rows[0];
    if (!row || new Date(row.expires_at).getTime() <= now.getTime()) return { ok: false, code: 'CODE_EXPIRED' };
    if (Number(row.attempts) >= MAX_CODE_ATTEMPTS) return { ok: false, code: 'TOO_MANY_ATTEMPTS' };

    await this.sql.query(`UPDATE auth_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    const expected = Buffer.from(String(row.code_hash), 'hex');
    const actual = Buffer.from(this.codeHash(email, purpose, code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { ok: false, code: 'INVALID_CODE' };

    await this.sql.query(`UPDATE auth_codes SET consumed = true WHERE id = $1`, [row.id]);

    let profile = await this.findProfile(email);
    if (purpose === 'admin') {
      if (!profile || profile.role !== 'admin') return { ok: false, code: 'NOT_ADMIN' };
    } else if (!profile) {
      profile = await this.createAccount(email);
    }
    if (profile.is_banned) return { ok: false, code: 'BANNED' };

    const token = randomBytes(32).toString('base64url');
    await this.sql.query(
      `INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2::uuid, $3::timestamptz)`,
      [sha256Hex(token), profile.id, new Date(now.getTime() + SESSION_TTL_MS).toISOString()],
    );
    return { ok: true, token, userId: profile.id, email, role: profile.role };
  }

  /** Пользователь по токену сессии (cookie). Забаненный и просроченный — null. */
  async userForToken(token: string): Promise<AuthUser | null> {
    const { rows } = await this.sql.query(
      `SELECT p.id, p.email, p.role
         FROM auth_sessions s JOIN app_profiles p ON p.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > $2::timestamptz AND p.is_banned = false`,
      [sha256Hex(token), this.now().toISOString()],
    );
    const r = rows[0];
    return r ? { userId: r.id, email: r.email, role: r.role } : null;
  }

  async logout(token: string): Promise<void> {
    await this.sql.query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [sha256Hex(token)]);
  }

  private async findProfile(email: string): Promise<{ id: string; role: string; is_banned: boolean } | null> {
    const { rows } = await this.sql.query(`SELECT id, role, is_banned FROM app_profiles WHERE email = $1`, [email]);
    return rows[0] ?? null;
  }

  /** Новый аккаунт: строка в auth.users; профиль создаёт триггер handle_new_user (роль всегда 'user'). */
  private async createAccount(email: string): Promise<{ id: string; role: string; is_banned: boolean }> {
    const id = randomUUID();
    await this.sql.query(`INSERT INTO auth.users (id, raw_user_meta_data) VALUES ($1::uuid, '{}'::jsonb)`, [id]);
    await this.sql.query(`UPDATE app_profiles SET email = $2 WHERE id = $1::uuid`, [id, email]);
    return { id, role: 'user', is_banned: false };
  }
}
