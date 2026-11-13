// Единая точка чтения переменных окружения фронтенда. Секретов здесь быть не должно (только anon key).
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  pipelineUrl: import.meta.env.VITE_PIPELINE_URL,
  // POST обращений в поддержку (бэкенд pipeline-api, маршрут /support). По умолчанию — локальный бэкенд.
  supportEndpoint: import.meta.env.VITE_SUPPORT_ENDPOINT || 'http://localhost:8080/support',
  chatEndpoint: import.meta.env.VITE_CHAT_ENDPOINT || 'http://localhost:8080/chat',
  defaultUserId: import.meta.env.VITE_DEFAULT_USER_ID || '550e8400-e29b-41d4-a716-446655440000',
} as const;
