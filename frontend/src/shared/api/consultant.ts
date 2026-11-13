import type { ConsultantResponse } from '@passport/contracts';
import { env } from '../config/env';

/** Вопрос ИИ-консультанту (задача 4.1). Ответ может быть ANSWER (с предупреждениями) или BLOCKED. */
export async function askConsultant(message: string, userId = env.userId): Promise<ConsultantResponse> {
  const res = await fetch(env.consultantEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, message }),
  });
  if (!res.ok) throw new Error(`Consultant HTTP ${res.status}`);
  return (await res.json()) as ConsultantResponse;
}
