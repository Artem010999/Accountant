// Единая точка чтения переменных окружения фронтенда. Секретов здесь быть не должно (только anon key).
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  pipelineUrl: import.meta.env.VITE_PIPELINE_URL,
  // POST обращений в поддержку (бэкенд pipeline-api, маршрут /support). По умолчанию — локальный бэкенд.
  supportEndpoint: import.meta.env.VITE_SUPPORT_ENDPOINT || 'http://localhost:8080/support',
  // ИИ-консультант (POST) и выгрузка паспорта (POST /export, GET /export/:id). По умолчанию — через прокси nginx.
  consultantEndpoint: import.meta.env.VITE_CONSULTANT_ENDPOINT || '/consultant',
  exportEndpoint: import.meta.env.VITE_EXPORT_ENDPOINT || '/export',
  // Пользователь для вызовов консультанта и выгрузки. Пока нет входа (G5.2): задаётся в окружении.
  userId: import.meta.env.VITE_USER_ID || '',
} as const;
