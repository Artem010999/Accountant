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

function tryLoadEnv() {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile();
    } catch {}
    try {
      const rootEnv = resolve(BACKEND_DIR, '..', '.env');
      process.loadEnvFile(rootEnv);
    } catch {}
  }
}
tryLoadEnv();

export interface AppConfig {
  port: number;
  databaseUrl: string | undefined;
  openaiApiKey: string | undefined;
  openaiBaseUrl: string;
  openaiChatModel: string;
  openaiEmbeddingModel: string;

  // 1. Канал OpenCode Go (DeepSeek — сборка блоков, тех. подход и аналоги, чат-консультант)
  deepseekBaseUrl: string;
  deepseekApiKey: string | undefined;
  deepseekModel: string;

  // 2. Канал Kimi Code (Kimi — первичный аудит и точечный ре-аудит)
  kimiBaseUrl: string;
  kimiApiKey: string | undefined;
  kimiModel: string;

  // 3. Канал Эмбеддингов AITunnel (Qwen3 Embedding 8B — анти-фрод якорь и RAG)
  embeddingBaseUrl: string;
  embeddingApiKey: string | undefined;
  embeddingModel: string;
  embeddingDimensions: number;

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
    openaiChatModel: env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
    openaiEmbeddingModel: env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',

    // 1. OpenCode Go (DeepSeek)
    deepseekBaseUrl: env.DEEPSEEK_BASE_URL || 'https://opencode.ai/zen/go/v1',
    deepseekApiKey: env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY,
    deepseekModel: env.DEEPSEEK_MODEL || 'deepseek-v4.1-flash',

    // 2. Kimi Code (Kimi)
    kimiBaseUrl: env.KIMI_BASE_URL || 'https://api.kimi.ai/coding/v1',
    kimiApiKey: env.KIMI_API_KEY || env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY,
    kimiModel: env.KIMI_MODEL || 'kimi-k3',

    // 3. AITunnel (Qwen3 Embeddings)
    embeddingBaseUrl: env.EMBEDDING_BASE_URL || 'https://api.aitunnel.ru/v1/',
    embeddingApiKey: env.EMBEDDING_API_KEY || env.OPENAI_API_KEY,
    embeddingModel: env.EMBEDDING_MODEL || 'qwen3-embedding-8b',
    embeddingDimensions: Number(env.EMBEDDING_DIMENSIONS || 4096),

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

export const config = loadConfig();

export const deepseekBaseUrl = config.deepseekBaseUrl;
export const deepseekApiKey = config.deepseekApiKey;
export const deepseekModel = config.deepseekModel;
export const kimiBaseUrl = config.kimiBaseUrl;
export const kimiApiKey = config.kimiApiKey;
export const kimiModel = config.kimiModel;
export const embeddingBaseUrl = config.embeddingBaseUrl;
export const embeddingApiKey = config.embeddingApiKey;
export const embeddingModel = config.embeddingModel;
export const embeddingDimensions = config.embeddingDimensions;
