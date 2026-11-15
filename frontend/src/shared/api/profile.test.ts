import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchChallenges } from './challenges';
import { saveFounder } from './profile';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('адаптеры профиля и справочника', () => {
  it('saveFounder шлёт user_id и данные основателя в POST /profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"status":"OK"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const ok = await saveFounder({ full_name: 'Петрова Мария', university: 'СамГТУ' }, 'user-1');
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/profile');
    expect(JSON.parse(String(init.body))).toEqual({ user_id: 'user-1', founder: { full_name: 'Петрова Мария', university: 'СамГТУ' } });
  });

  it('saveFounder возвращает false при ошибке сервера', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 422 })));
    expect(await saveFounder({ full_name: 'Х' }, 'user-1')).toBe(false);
  });

  it('fetchChallenges читает список из GET /challenges', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ challenges: [{ number: 1, direction: 'Н1', partner: 'П', topic: 'Т' }] }), { status: 200 })),
    );
    const list = await fetchChallenges();
    expect(list).toEqual([{ number: 1, direction: 'Н1', partner: 'П', topic: 'Т' }]);
  });
});
