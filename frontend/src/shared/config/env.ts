// Единая точка чтения переменных окружения фронтенда. Секретов здесь быть не должно (только anon key).
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  pipelineUrl: import.meta.env.VITE_PIPELINE_URL,
} as const;
