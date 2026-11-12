// Единая точка чтения переменных окружения фронтенда. Секретов здесь быть не должно (только anon key).
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  pipelineUrl: import.meta.env.VITE_PIPELINE_URL,
  // POST обращений в поддержку (бэкенд pipeline-api, маршрут /support). По умолчанию — локальный бэкенд.
  supportEndpoint: import.meta.env.VITE_SUPPORT_ENDPOINT || 'http://localhost:8080/support',
} as const;
