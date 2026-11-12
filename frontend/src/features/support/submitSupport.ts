import { env } from '../../shared/config/env';

export interface SupportRequestBody {
  email: string;
  name: string;
  message: string;
}

/**
 * Единственная функция, которая обращается к бэкенду поддержки: POST на env.supportEndpoint.
 * Бросает исключение при ошибке сети и при ответе не 2xx; форма показывает общий текст ошибки.
 */
export async function submitSupport(body: SupportRequestBody): Promise<void> {
  const res = await fetch(env.supportEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Support HTTP ${res.status}`);
}
