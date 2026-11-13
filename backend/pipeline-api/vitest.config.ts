import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    // Тесты не ходят во внешние сервисы: нейросеть — FakeLlm, а эмбеддинги уходят на закрытый локальный порт,
    // поэтому RAG-поиск аудита падает сразу и аудит продолжает без контекста (а не ждёт таймаутов из .env).
    env: {
      OPENAI_API_KEY: 'test-no-network',
      EMBEDDING_API_KEY: 'test-no-network',
      EMBEDDING_BASE_URL: 'http://127.0.0.1:9/v1',
      DEEPSEEK_API_KEY: 'test-no-network',
      KIMI_API_KEY: 'test-no-network',
      DEEPSEEK_BASE_URL: 'http://127.0.0.1:9/v1',
      KIMI_BASE_URL: 'http://127.0.0.1:9/v1',
    },
  },
});
