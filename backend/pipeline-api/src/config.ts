import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Папка backend/ (содержит supabase/ и kb/). */
export const BACKEND_DIR = resolve(here, '..', '..');
export const SUPABASE_DIR = resolve(BACKEND_DIR, 'supabase');
export const DEFAULT_MANIFEST_PATH = resolve(BACKEND_DIR, 'kb', 'programs', 'student-startup', 'manifest.json');

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
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 8080),
    databaseUrl: env.SUPABASE_DB_URL ?? env.DATABASE_URL,
    openaiApiKey: env.OPENAI_API_KEY,
    openaiBaseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openaiChatModel: env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
    openaiEmbeddingModel: env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    parserUrl: env.PARSER_URL ?? 'http://localhost:8000',
    manifestPath: env.KB_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH,
    sharedSecret: env.PIPELINE_SHARED_SECRET || undefined,
  };
}
