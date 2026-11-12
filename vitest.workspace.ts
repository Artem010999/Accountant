import { defineWorkspace } from 'vitest/config';

// Единый запуск тестов из корня (`npm test`): контракты и passport-core, пайплайн, фронтенд.
export default defineWorkspace(['packages/*', 'backend/pipeline-api', 'frontend']);
