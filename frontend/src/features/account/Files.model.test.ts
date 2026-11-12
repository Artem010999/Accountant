import { describe, expect, it } from 'vitest';
import { SEED_FILES, filesPlan, localFilesApi, type ProjectFile } from './Files.model';

function filesOf(count: number): ProjectFile[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `f${i}.pdf`,
    ext: 'PDF',
    kind: 'pdf' as const,
    mb: 1,
    date: '01.01.2026',
    claims: 0,
    st: 'ok' as const,
    sha256: `hash-${i}`,
  }));
}

describe('Files.model: тарифы и лимиты', () => {
  it('лимит файлов берётся из данных тарифа: 10 на «Профессиональном», 50 на «Премиуме»', () => {
    expect(filesPlan('pro').file_uploads_limit).toBe(10);
    expect(filesPlan('premium').file_uploads_limit).toBe(50);
  });

  it('локальная загрузка: при лимите тарифа 429, ниже лимита — принимается', async () => {
    const request = { name: 'new.pdf', sizeMb: 1, sha256: 'new-hash' };
    expect(await localFilesApi.upload({ ...request, existing: filesOf(49), fileLimit: 50 })).toEqual({ status: 'accepted' });
    expect(await localFilesApi.upload({ ...request, existing: filesOf(50), fileLimit: 50 })).toEqual({
      status: 'FILE_QUOTA_EXCEEDED',
    });
    expect(await localFilesApi.upload({ ...request, existing: filesOf(10), fileLimit: 10 })).toEqual({
      status: 'FILE_QUOTA_EXCEEDED',
    });
  });

  it('дубль по sha256 не занимает место в лимите: проверяется раньше лимита', async () => {
    const existing = filesOf(10);
    expect(await localFilesApi.upload({ name: 'copy.pdf', sizeMb: 1, sha256: 'hash-3', existing, fileLimit: 10 })).toEqual({
      status: 'duplicate',
    });
  });

  it('демо-данные из дизайна: три файла', () => {
    expect(SEED_FILES).toHaveLength(3);
  });
});
