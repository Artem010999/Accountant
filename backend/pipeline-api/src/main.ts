import pg from 'pg';
import { loadConfig } from './config';
import { PassportStore } from './db/store';
import { fromPgPool } from './db/sql';
import { loadKbManifest } from './kb/manifest';
import { OpenAiClient } from './llm/openai';
import { HttpDocumentParser } from './parser/client';
import { createPipelineServer } from './server';

const { Pool } = pg;

async function main() {
  const cfg = loadConfig();
  if (!cfg.databaseUrl) throw new Error('Задайте SUPABASE_DB_URL (строка подключения Postgres)');
  if (!cfg.openaiApiKey) throw new Error('Задайте OPENAI_API_KEY');
  if (!cfg.sharedSecret) console.warn('[warn] PIPELINE_SHARED_SECRET не задан: HTTP-вход без аутентификации');

  const pool = new Pool({ connectionString: cfg.databaseUrl });
  const deps = {
    store: new PassportStore(fromPgPool(pool)),
    llm: new OpenAiClient({
      apiKey: cfg.openaiApiKey,
      baseUrl: cfg.openaiBaseUrl,
      chatModel: cfg.openaiChatModel,
      embeddingModel: cfg.openaiEmbeddingModel,
    }),
    parser: new HttpDocumentParser(cfg.parserUrl),
    kb: loadKbManifest(cfg.manifestPath),
    logger: console,
  };

  const server = createPipelineServer(deps, { sharedSecret: cfg.sharedSecret });
  server.listen(cfg.port, () => console.log(`pipeline-api listening on :${cfg.port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
