// Модель экрана «Материалы проекта» (Files). Эталон: design/project/Files.dc.html (DCLogic: renderVals, toasts).
// Правила загрузки — docs/user-flows.md F4 и F10: дубль по sha256 не занимает место в лимите,
// файл с тем же именем и другим хешем — новый источник, превышение лимита — 429, Free — 402, чужой проект — BLOCKED_PROJECT_SWAP.

import { PLANS, type Plan, type PlanId } from '../../shared/data/plans';

export type FileKind = 'pdf' | 'scan' | 'docx' | 'other';

export interface ProjectFile {
  id: number;
  name: string;
  /** Расширение для плашки: PDF, DOCX и т.д. */
  ext: string;
  kind: FileKind;
  /** «15 страниц». Для файла, который только что загрузили, число страниц ещё неизвестно. */
  pages?: string;
  /** Размер в мегабайтах (одна десятая). */
  mb: number;
  /** Дата загрузки ДД.ММ.ГГГГ. */
  date: string;
  /** Сколько утверждений Буха извлекла из файла. */
  claims: number;
  /** ok — разобран; ocr — скан, распознан; parsing — разбирается. */
  st: 'ok' | 'ocr' | 'parsing';
  sha256?: string;
}

/** Лимит объёма («из 200 МБ» в Files.dc.html). */
export const SIZE_LIMIT_MB = 200;

/** Тариф берём из данных shared/data/plans.ts: лимит файлов — file_uploads_limit (pro 10, premium 50). */
export type FilesPlanId = PlanId;

export function filesPlan(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Тариф не найден: ${id}`);
  return plan;
}

/** Ответ на загрузку: статусы совпадают с кодами бэкенда из user-flows F4 / F10 и States.dc.html. */
export type UploadStatus =
  | 'accepted'
  | 'duplicate'
  | 'FILE_QUOTA_EXCEEDED'
  | 'PLAN_UPGRADE_REQUIRED'
  | 'BLOCKED_PROJECT_SWAP';

export interface UploadRequest {
  name: string;
  sizeMb: number;
  sha256: string;
  existing: ProjectFile[];
  /** Лимит файлов тарифа проекта. */
  fileLimit: number;
}

export interface FilesApi {
  upload(request: UploadRequest): Promise<{ status: UploadStatus }>;
}

/**
 * Локальная реализация до подключения пайплайна (G5): дубль по sha256 и лимит тарифа проверяем здесь.
 * Тариф (402) и проверку Стража (BLOCKED_PROJECT_SWAP) локально не решить: их отдаёт бэкенд.
 */
export const localFilesApi: FilesApi = {
  async upload({ sha256, existing, fileLimit }) {
    if (existing.some((f) => f.sha256 === sha256)) return { status: 'duplicate' };
    if (existing.length >= fileLimit) return { status: 'FILE_QUOTA_EXCEEDED' };
    return { status: 'accepted' };
  },
};

/** Демо-данные из Files.dc.html (состояние по умолчанию). */
export const SEED_FILES: ProjectFile[] = [
  { id: 1, name: 'Monetrix_presentation_02.11.pdf', ext: 'PDF', kind: 'pdf', pages: '15 страниц', mb: 4.2, date: '02.11.2026', claims: 18, st: 'ok' },
  { id: 2, name: 'Svidetelstvo_RID_scan.pdf', ext: 'PDF', kind: 'scan', pages: 'скан, 2 страницы', mb: 1.8, date: '02.11.2026', claims: 3, st: 'ocr' },
  { id: 3, name: 'Biznes-plan_Monetrix.docx', ext: 'DOCX', kind: 'docx', pages: '24 страницы', mb: 6.4, date: '05.11.2026', claims: 11, st: 'ok' },
];

/** Число с падежом, как в Files.dc.html: «1 утверждение», «2 утверждения», «5 утверждений». */
export function claimsWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} утверждение`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return `${n} утверждения`;
  return `${n} утверждений`;
}

/** «4,2 МБ» — запятая как в эталоне. */
export function formatMb(mb: number): string {
  return `${mb.toFixed(1).replace('.', ',')} МБ`;
}

export function kindFromExt(ext: string): FileKind {
  const e = ext.toLowerCase();
  if (e === 'pdf') return 'pdf';
  if (e === 'docx' || e === 'doc') return 'docx';
  return 'other';
}

export function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toUpperCase() : 'FILE';
}

/** Дата сегодняшнего дня в формате ДД.ММ.ГГГГ. */
export function formatToday(now: Date = new Date()): string {
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${now.getFullYear()}`;
}

function readBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/** SHA-256 содержимого файла в hex: по нему определяется повторная загрузка. */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await readBuffer(blob));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
