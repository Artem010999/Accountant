import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Папка backend/ (содержит supabase/ и kb/). */
export const BACKEND_DIR = resolve(here, '..', '..');
export const SUPABASE_DIR = resolve(BACKEND_DIR, 'supabase');
export const DEFAULT_MANIFEST_PATH = resolve(BACKEND_DIR, 'kb', 'programs', 'student-startup', 'manifest.json');
/** Папка pipeline-api/ (содержит src/ и outbox/). */
export const PIPELINE_API_DIR = resolve(here, '..');
export const DEFAULT_OUTBOX_DIR = resolve(PIPELINE_API_DIR, 'outbox');

export interface AppConfig {
  port: number;
  databaseUrl: string | undefined;
  openaiApiKey: string | undefined;
  openaiBaseUrl: string;
  openaiChatModel: string;
  openaiEmbeddingModel: string;
  parserUrl: string;
  manifestPath: string;
  /** Если задан — HTTP-вход требует заголовок x-pipeline-secret с этим значением. */
  sharedSecret: string | undefined;
  /** Получатель обращений в поддержку (SUPPORT_EMAIL). */
  supportEmail: string;
  /** Единственный origin фронтенда, для которого открыт CORS на POST /support (SUPPORT_ALLOWED_ORIGIN). */
  supportAllowedOrigin: string;
  /** Папка писем для адаптера OutboxMail (OUTBOX_DIR). */
  outboxDir: string;
  /** SMTP: адаптер SmtpMail включается, если задан host; иначе письма пишутся в outbox. */
  smtp: {
    host: string | undefined;
    port: number;
    user: string | undefined;
    pass: string | undefined;
    from: string | undefined;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 8080),
    databaseUrl: env.SUPABASE_DB_URL ?? env.DATABASE_URL,
    openaiApiKey: env.OPENAI_API_KEY,
    openaiBaseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    // TODO(разработчик, S1): модели задач — DeepSeek Flash (extract, pack, anchor, validate_answer, navigator),
    // Kimi k3 (audit, novelty, reaudit), DeepSeek (consultant). Точные ID моделей и адреса API не заданы;
    // пока работает одна модель из OPENAI_CHAT_MODEL. Эмбеддинги: провайдер не выбран, см. docs/PLAN-v1.1.md Q1, Q15.
    openaiChatModel: env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
    openaiEmbeddingModel: env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    parserUrl: env.PARSER_URL ?? 'http://localhost:8000',
    manifestPath: env.KB_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH,
    sharedSecret: env.PIPELINE_SHARED_SECRET || undefined,
    supportEmail: env.SUPPORT_EMAIL || 'test@test.com',
    supportAllowedOrigin: env.SUPPORT_ALLOWED_ORIGIN || 'http://localhost:5173',
    outboxDir: env.OUTBOX_DIR || DEFAULT_OUTBOX_DIR,
    smtp: {
      host: env.SMTP_HOST || undefined,
      port: Number(env.SMTP_PORT || 587),
      user: env.SMTP_USER || undefined,
      pass: env.SMTP_PASS || undefined,
      from: env.MAIL_FROM || env.SMTP_USER || undefined,
    },
  };
}
