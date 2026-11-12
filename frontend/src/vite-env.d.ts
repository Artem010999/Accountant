/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_PIPELINE_URL: string;
  /** Необязательная: без неё используется http://localhost:8080/support (см. shared/config/env.ts). */
  readonly VITE_SUPPORT_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
