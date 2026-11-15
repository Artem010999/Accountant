import { env } from '../config/env';

/** Данные основателя (блок 1 паспорта). Поля совпадают с FOUNDER_FIELD_KEYS на бэкенде. */
export interface FounderInput {
  full_name: string;
  contacts?: string;
  education_status?: 'student' | 'postgraduate';
  university?: string;
  region?: string;
}

/** Сохраняет ФИО и данные основателя. Возвращает true, если сохранено. */
export async function saveFounder(founder: FounderInput, userId = env.defaultUserId): Promise<boolean> {
  const res = await fetch(env.profileEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, founder }),
  });
  return res.ok;
}
