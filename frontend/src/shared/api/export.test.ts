import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPassportExport } from './export';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestPassportExport', () => {
  it('отправляет пользователя и 10 секций, возвращает ссылку на файл', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'EXPORT_READY', export_id: 'e1', file_name: 'passport.docx', download_path: '/export/e1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const sections = [{ section_id: 1, fields: [{ field_key: 'full_name', value: 'Петрова Мария' }] }];
    const res = await requestPassportExport(sections, 'user-1');

    expect(res).toMatchObject({ status: 'EXPORT_READY', download_path: '/export/e1' });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init.body))).toEqual({ user_id: 'user-1', sections });
    expect(init.method).toBe('POST');
  });

  it('ответ ERROR (например, NOT_APPROVED) возвращается как есть, без исключения', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ERROR', code: 'NOT_APPROVED', message: 'Не одобрено' }), { status: 422 })),
    );
    const res = await requestPassportExport([], 'user-1');
    expect(res).toEqual({ status: 'ERROR', code: 'NOT_APPROVED', message: 'Не одобрено' });
  });

  it('сбой сервера (500) — исключение', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    await expect(requestPassportExport([], 'user-1')).rejects.toThrow('Export HTTP 500');
  });
});
