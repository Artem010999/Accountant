import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 120000, // аудит ходит в RAG по сети (эмбеддинги): в этой среде один вызов занимает до ~25 с
    hookTimeout: 120000,
    fileParallelism: false,
    // Нейросеть в тестах — FakeLlm. Ключи и адреса чат-моделей (DeepSeek, Kimi) уводим на закрытый локальный порт,
    // чтобы тесты не ждали внешней сети. Эмбеддинги НЕ трогаем: тесты RAG-контекста работают на реальном сервисе.
    env: {
      DEEPSEEK_API_KEY: 'test-no-network',
      KIMI_API_KEY: 'test-no-network',
      DEEPSEEK_BASE_URL: 'http://127.0.0.1:9/v1',
      KIMI_BASE_URL: 'http://127.0.0.1:9/v1',
    },
  },
});
