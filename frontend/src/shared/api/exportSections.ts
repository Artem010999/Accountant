import type { PipelineCompleted } from '@passport/contracts';
import { env } from '../config/env';
import type { FounderInput } from './profile';
import { requestPassportExport, type ExportSectionInput } from './export';

const FOUNDER_KEYS: (keyof FounderInput)[] = ['full_name', 'contacts', 'education_status', 'university', 'region'];

/** 10 секций для выгрузки: секция 1 — из профиля, 2–10 — из ответа COMPLETED.passport. */
export function buildExportSections(founder: FounderInput, passport: PipelineCompleted['passport']): ExportSectionInput[] {
  const founderSection: ExportSectionInput = {
    section_id: 1,
    fields: FOUNDER_KEYS.map((key) => ({ field_key: key, value: String(founder[key] ?? '') })),
  };
  const bySection = new Map<number, ExportSectionInput>();
  for (const f of passport) {
    const section = bySection.get(f.section_id) ?? { section_id: f.section_id, fields: [] };
    section.fields.push({ field_key: f.field_key, value: f.value ?? '' });
    bySection.set(f.section_id, section);
  }
  return [founderSection, ...[...bySection.values()].sort((a, b) => a.section_id - b.section_id)];
}

/**
 * Скачивание DOCX: POST /export (проверка одобрения и сверка) → GET /export/:id → файл в браузере.
 * Возвращает текст ошибки для показа пользователю или null при успехе.
 */
export async function downloadPassport(founder: FounderInput, passport: PipelineCompleted['passport']): Promise<string | null> {
  const result = await requestPassportExport(buildExportSections(founder, passport));
  if (result.status !== 'EXPORT_READY') return result.message;
  const res = await fetch(`${env.exportEndpoint}/${result.export_id}`, { headers: { 'x-user-id': env.defaultUserId } });
  if (!res.ok) return `Не удалось скачать файл (HTTP ${res.status})`;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = result.file_name;
  a.click();
  URL.revokeObjectURL(url);
  return null;
}
