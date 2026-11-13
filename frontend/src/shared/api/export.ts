import { env } from '../config/env';

/** Одно поле секции: ключ из реестра (contracts/sections.ts) и текущее значение с экрана. */
export interface ExportFieldInput {
  field_key: string;
  value: string;
}

/** Одна из 10 секций паспорта: section_id 1 — основатель, 2–10 — блоки паспорта. */
export interface ExportSectionInput {
  section_id: number;
  fields: ExportFieldInput[];
}

export interface ExportReadyResponse {
  status: 'EXPORT_READY';
  export_id: string;
  file_name: string;
  download_path: string;
}

export interface ExportErrorResponse {
  status: 'ERROR';
  code: string;
  message: string;
}

/**
 * Скачивание: передаём 10 секций, сервер проверяет одобрение и совпадение с сохранённым, собирает DOCX.
 * Возвращает ссылку на файл или ошибку (например, NOT_APPROVED / STALE_EXPORT).
 */
export async function requestPassportExport(sections: ExportSectionInput[], userId = env.userId): Promise<ExportReadyResponse | ExportErrorResponse> {
  const res = await fetch(env.exportEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, sections }),
  });
  if (!res.ok && res.status !== 422) throw new Error(`Export HTTP ${res.status}`);
  return (await res.json()) as ExportReadyResponse | ExportErrorResponse;
}
