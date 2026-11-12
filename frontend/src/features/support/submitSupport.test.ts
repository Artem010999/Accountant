import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../shared/config/env';
import { submitSupport, type SupportRequestBody } from './submitSupport';

const body: SupportRequestBody = {
  email: 'ivan@university.ru',
  name: 'Иван Иванов',
  message: 'Не могу загрузить файл',
};

const fetchMock = vi.fn();

describe('submitSupport', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('отправляет POST на env.supportEndpoint с JSON-телом и Content-Type', async () => {
    fetchMock.mockResolvedValue(new Response('{"status":"sent"}', { status: 200 }));

    await submitSupport(body);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(env.supportEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });

  it('ответ не 2xx — ошибка с кодом статуса', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));
    await expect(submitSupport(body)).rejects.toThrow('Support HTTP 500');
  });

  it('ошибка сети пробрасывается наружу', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(submitSupport(body)).rejects.toThrow('Failed to fetch');
  });
});
