// Точка входа только для обращений в поддержку: npm run start:support -w @passport/pipeline-api
// Не требует SUPABASE_DB_URL и OPENAI_API_KEY (их требует полный сервис src/main.ts).
import { loadConfig } from '../config';
import { createSupportServer } from './server';
import { supportOptionsFromConfig } from './options';

const cfg = loadConfig();
const server = createSupportServer(supportOptionsFromConfig(cfg));
server.listen(cfg.port, () => console.log(`support-api listening on :${cfg.port}`));
