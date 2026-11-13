import { env } from '../../shared/config/env';
import type {
  ConsultantChatResponse,
  ConsultantHistoryResponse,
} from '@passport/contracts';

export async function fetchChatHistory(
  userId = env.defaultUserId,
): Promise<ConsultantHistoryResponse> {
  const url = `${env.chatEndpoint}?user_id=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Ошибка загрузки истории чата: HTTP ${res.status}`);
  }
  return res.json();
}

export async function sendChatMessage(params: {
  userId?: string;
  message: string;
  activeSectionId?: number;
}): Promise<ConsultantChatResponse> {
  const payload = {
    user_id: params.userId || env.defaultUserId,
    message: params.message,
    ...(params.activeSectionId !== undefined ? { active_section_id: params.activeSectionId } : {}),
  };

  const res = await fetch(env.chatEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Ошибка отправки сообщения: HTTP ${res.status}`);
  }
  return res.json();
}
