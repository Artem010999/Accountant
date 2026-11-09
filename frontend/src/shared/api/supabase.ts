import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Клиент с anon key. Доступ к данным ограничен RLS; служебные таблицы (billing_payments,
// admin_audit_log, project_guard_events, kb_documents) для anon/authenticated закрыты REVOKE.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
