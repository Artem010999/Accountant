// Задача 4.2: выгрузка паспорта в DOCX по нажатию «Скачать».
// Фронтенд передаёт 10 секций. Сервер проверяет, что одобрено всё, и что переданный текст совпадает
// с сохранённым и одобренным (иначе экран устарел). Документ строится из проверенных данных.
import { createHash } from 'node:crypto';
import { PASSPORT_SECTIONS } from '@passport/contracts';
import { formatRub } from '@passport/passport-core';
import { PipelineFailure } from '../errors';
import type { BudgetRow, RecordRow, UserContext } from '../db/store';
import type { PipelineDeps } from './deps';
import { OPTIONAL_FIELDS } from './fieldValidation';
import { CATEGORY_TITLES, FIELD_TITLES, STAGE_TITLES } from './exportLabels';
import { EXPORT_CHECKLIST } from './exportChecklist';
import { buildPassportDocx, type ExportSection, type PassportExportData } from './exportDocx';

/** Секция 1 — профиль основателя (не в project_passport_records). */
const FOUNDER_SECTION = 1;
const FOUNDER_TITLE = 'Основатель';
const FOUNDER_LABELS: Record<string, string> = {
  full_name: 'ФИО',
  contacts: 'Контакты',
  education_status: 'Статус обучения',
  university: 'Вуз',
  region: 'Регион',
};

export interface ExportSectionInput {
  section_id: number;
  fields: { field_key: string; value: string }[];
}

export interface ExportRequestBody {
  user_id: string;
  sections: ExportSectionInput[];
}

/** Что ещё не одобрено (пусто — выгрузка разрешена). Секция 1 считается заполненной, если есть ФИО. */
export function notApproved(records: readonly RecordRow[], budget: readonly BudgetRow[], founderFilled: boolean): string[] {
  const missing: string[] = [];
  if (!founderFilled) missing.push(`${FOUNDER_TITLE}: ФИО не заполнено`);
  for (const section of PASSPORT_SECTIONS) {
    for (const fieldKey of section.fields) {
      if (OPTIONAL_FIELDS.has(`${section.id}/${fieldKey}`)) continue;
      const rec = records.find((r) => r.section_id === section.id && r.field_key === fieldKey);
      const filled = !!rec?.value?.trim();
      if (!filled || rec!.review_status !== 'approved') {
        missing.push(`${section.title}: ${FIELD_TITLES[fieldKey] ?? fieldKey}`);
      }
    }
  }
  if (budget.length === 0) {
    missing.push('Смета: не заполнена');
  } else {
    const unapproved = budget.filter((b) => b.review_status !== 'approved').length;
    if (unapproved > 0) missing.push(`Смета: не одобрено строк — ${unapproved}`);
  }
  return missing;
}

export interface ExportReady {
  status: 'EXPORT_READY';
  export_id: string;
  file_name: string;
  download_path: string;
}

export async function handleExport(deps: PipelineDeps, req: ExportRequestBody, ctx: UserContext): Promise<ExportReady> {
  const { store } = deps;
  const project = ctx.project;
  if (!project) throw new PipelineFailure('NOT_APPROVED', 'Проект не создан: паспорт ещё не заполнен.');

  const records = await store.getRecords(project.id);
  const budget = await store.getBudgetItems(project.id);
  const founderFilled = Boolean(ctx.founderData.full_name?.trim());
  const missing = notApproved(records, budget, founderFilled);
  if (missing.length > 0) {
    throw new PipelineFailure('NOT_APPROVED', `Выгрузка доступна, когда всё одобрено. Не одобрено: ${missing.join('; ')}`);
  }

  verifySections(req.sections, records, ctx.founderData);

  const data = await buildExportData(deps, project.id, req.sections, budget);
  const content = await buildPassportDocx(data);
  const sha256 = createHash('sha256').update(content).digest('hex');
  const fileName = `passport-${project.id.slice(0, 8)}.docx`;
  const exportId = await store.insertExport(project.id, req.user_id, fileName, sha256, content);
  return { status: 'EXPORT_READY', export_id: exportId, file_name: fileName, download_path: `/export/${exportId}` };
}

/**
 * Переданные секции должны совпадать с одобренными сохранёнными значениями.
 * Расхождение значит, что экран устарел или данные подменены: выгрузку не делаем.
 */
export function verifySections(sections: readonly ExportSectionInput[], records: readonly RecordRow[], founder: Record<string, any>): void {
  const stale = () => new PipelineFailure('STALE_EXPORT', 'Данные на экране отличаются от сохранённых. Обновите паспорт и повторите выгрузку.');

  const ids = sections.map((s) => s.section_id).sort((a, b) => a - b);
  const expected = [FOUNDER_SECTION, ...PASSPORT_SECTIONS.map((s) => s.id)];
  if (ids.length !== expected.length || ids.some((id, i) => id !== expected[i])) throw stale();

  for (const section of sections) {
    for (const field of section.fields) {
      const value = field.value.trim();
      if (section.section_id === FOUNDER_SECTION) {
        if (!(field.field_key in FOUNDER_LABELS)) throw stale();
        if (value !== String(founder[field.field_key] ?? '').trim()) throw stale();
        continue;
      }
      const rec = records.find((r) => r.section_id === section.section_id && r.field_key === field.field_key);
      if (!rec) {
        if (value !== '') throw stale(); // непустое значение без записи в базе — подмена
        continue;
      }
      if ((rec.value ?? '').trim() !== value) throw stale();
    }
  }
  // Каждое заполненное поле паспорта должно быть передано (иначе документ будет неполным).
  for (const rec of records) {
    if (rec.section_id < 2 || !rec.value?.trim()) continue;
    const sent = sections.find((s) => s.section_id === rec.section_id)?.fields.some((f) => f.field_key === rec.field_key);
    if (!sent) throw stale();
  }
}

/** Данные для построителя DOCX: порядок и подписи — из реестра секций, значения — из переданного и проверенного. */
export async function buildExportData(
  deps: PipelineDeps,
  projectId: string,
  sections: readonly ExportSectionInput[],
  budget: readonly BudgetRow[],
): Promise<PassportExportData> {
  const header = await deps.store.getProjectHeader(projectId);
  const valueOfSection = (id: number, key: string): string => sections.find((s) => s.section_id === id)?.fields.find((f) => f.field_key === key)?.value.trim() ?? '';

  const exportSections: ExportSection[] = [
    {
      number: FOUNDER_SECTION,
      title: FOUNDER_TITLE,
      fields: Object.entries(FOUNDER_LABELS)
        .map(([key, label]) => ({ label, value: valueOfSection(FOUNDER_SECTION, key) }))
        .filter((f) => f.value.length > 0),
    },
    ...PASSPORT_SECTIONS.map((s) => ({
      number: s.id,
      title: s.title,
      fields: s.fields
        .map((f) => ({ label: FIELD_TITLES[f] ?? f, value: valueOfSection(s.id, f) }))
        .filter((f) => f.value.length > 0),
    })),
  ];

  const total = budget.reduce((sum, b) => sum + Number(b.amount), 0);
  return {
    title: header.title,
    founder_name: header.founder_name,
    generated_at: formatDate(new Date()),
    sections: exportSections,
    budget: budget.map((b) => ({
      stage_label: STAGE_TITLES[b.stage],
      category_label: CATEGORY_TITLES[b.category],
      title: b.title,
      quantity: plain(Number(b.quantity)),
      unit_price: plain(Number(b.unit_price)),
      amount: plain(Number(b.amount)),
      justification: b.justification,
    })),
    budget_total: plain(total),
    checklist: [...EXPORT_CHECKLIST],
  };
}

/** Число без знака валюты (разделитель тысяч — неразрывный пробел). */
function plain(n: number): string {
  return formatRub(n).replace(/\s?₽$/, '');
}

function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
