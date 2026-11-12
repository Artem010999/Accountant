// База знаний «Буха» (админка, /admin/kb): модель, демо-данные и сервис.
// Значения и тексты — из design/project/AdminKB.dc.html (renderVals). Правила — docs/user-flows.md F17.
// Бэкенда до G5 нет: экран работает через интерфейс KbService; демо-реализация хранит данные в памяти.
// Хеш в эталоне сокращённый («a41c…02fe»), поэтому демо-данные и проверка дубля сравнивают сокращённую форму.
// На G5 проверка дубля делается по полному sha256 на бэкенде.

export type KbDocType = 'regulation' | 'questionnaire' | 'examples' | 'stop_rules' | 'criteria';
export type KbDocStatus = 'active' | 'archive' | 'scheduled';
export type KbStatusTone = 'on' | 'off' | 'soon';

export interface KbDocTypeOption {
  id: KbDocType;
  /** Название в списке «Тип» формы. */
  label: string;
  /** Короткое название в колонке «Тип» таблицы. */
  short: string;
  /** Заголовок документа по умолчанию для нового файла этого типа. */
  title: string;
}

// Пять типов из эталона (select «Тип»). Для «Критерии оценки» короткое название и заголовок
// в эталоне не заданы — значения временные, отмечены в отчёте.
export const KB_DOC_TYPES: readonly KbDocTypeOption[] = [
  { id: 'regulation', label: 'Положение о программе', short: 'Положение', title: 'Положение о программе' },
  { id: 'questionnaire', label: 'Анкета и вопросы', short: 'Анкета и вопросы', title: 'Анкета и вопросы по полям' },
  { id: 'examples', label: 'Эталонные примеры', short: 'Примеры', title: 'Эталонные примеры ответов' },
  { id: 'stop_rules', label: 'Правила стоп-факторов', short: 'Правила', title: 'Правила стоп-факторов' },
  { id: 'criteria', label: 'Критерии оценки', short: 'Критерии', title: 'Критерии оценки' },
];

export function kbDocTypeOption(id: KbDocType): KbDocTypeOption {
  const found = KB_DOC_TYPES.find((t) => t.id === id);
  if (!found) throw new Error(`Неизвестный тип документа: ${id}`);
  return found;
}

export interface KbProgram {
  id: string;
  /** Текст вкладки и пункта списка «Программа» — дословно из эталона. */
  label: string;
  enabled: boolean;
}

export const KB_PROGRAMS: readonly KbProgram[] = [
  { id: 'studstartup', label: 'Студенческий стартап', enabled: true },
  { id: 'start1', label: 'Старт-1 · скоро', enabled: false },
  { id: 'skolkovo', label: 'Сколково · скоро', enabled: false },
];

export const KB_DEFAULT_PROGRAM = 'studstartup';

export interface KbDocument {
  id: string;
  programId: string;
  title: string;
  /** Путь к файлу в хранилище (показывается под названием). */
  key: string;
  type: KbDocType;
  version: string;
  /** Дата начала действия, ISO YYYY-MM-DD. */
  validFrom: string;
  /** Сокращённый хеш sha256: первые четыре и последние четыре символа через «…». */
  hash: string;
  status: KbDocStatus;
}

/** Запись документа без статуса: статус не хранится, а вычисляется по дате (см. resolveKbStatuses). */
export type KbDocRecord = Omit<KbDocument, 'status'>;

const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** ISO YYYY-MM-DD → ДД.ММ.ГГГГ. */
export function formatRuDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Текст статуса как в эталоне: «Действует», «Архив», «С 1 декабря». */
export function kbStatusLabel(doc: Pick<KbDocument, 'status' | 'validFrom'>): string {
  if (doc.status === 'active') return 'Действует';
  if (doc.status === 'archive') return 'Архив';
  const [, m, d] = doc.validFrom.split('-');
  return `С ${Number(d)} ${MONTHS_GEN[Number(m) - 1]}`;
}

export function kbStatusTone(status: KbDocStatus): KbStatusTone {
  if (status === 'active') return 'on';
  if (status === 'archive') return 'off';
  return 'soon';
}

export function shortHash(hex: string): string {
  return `${hex.slice(0, 4)}…${hex.slice(-4)}`;
}

export interface KbUploadInput {
  programId: string;
  type: KbDocType;
  version: string;
  /** ISO YYYY-MM-DD. */
  validFrom: string;
  file: File;
}

export type KbUploadResult =
  | { ok: true; document: KbDocument }
  | { ok: false; reason: 'duplicate_hash' };

export interface KbService {
  listDocuments(programId: string): Promise<KbDocument[]>;
  uploadDocument(input: KbUploadInput): Promise<KbUploadResult>;
}

/** Принимаемые форматы файла документа (решение владельца: JSON не принимается). */
export const KB_ACCEPTED_EXTENSIONS: readonly string[] = ['.pdf', '.docx'];
/** Лимит размера файла: 50 МБ (мебибайт, 1 МБ = 1024 × 1024 байт). */
export const KB_MAX_FILE_BYTES = 50 * 1024 * 1024;

export const KB_FILE_TYPE_ERROR = 'Допустимы только PDF и DOCX';
export const KB_FILE_SIZE_ERROR = 'Файл больше 50 МБ. Загрузите файл меньшего размера.';

/** Проверка файла документа: формат, затем размер. Возвращает текст ошибки или null. */
export function kbFileError(file: Pick<File, 'name' | 'size'>): string | null {
  const name = file.name.toLowerCase();
  if (!KB_ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) return KB_FILE_TYPE_ERROR;
  if (file.size > KB_MAX_FILE_BYTES) return KB_FILE_SIZE_ERROR;
  return null;
}

/** Демо-документы программы «Студенческий стартап» из эталона AdminKB.dc.html. */
export const DEMO_KB_RECORDS: readonly KbDocRecord[] = [
  {
    id: 'doc-reg-1-0', programId: 'studstartup', title: 'Положение о программе',
    key: 'kb/fasie/studstartup/reg_v1.pdf', type: 'regulation', version: '1.0',
    validFrom: '2026-01-01', hash: 'xyz7…9hash',
  },
  {
    id: 'doc-questions-1-0', programId: 'studstartup', title: 'Анкета и вопросы по полям',
    key: 'kb/fasie/studstartup/questions_v1.docx', type: 'questionnaire', version: '1.0',
    validFrom: '2026-01-01', hash: 'a41c…02fe',
  },
  {
    id: 'doc-examples-1-0', programId: 'studstartup', title: 'Эталонные примеры ответов',
    key: 'kb/fasie/studstartup/examples_v1.docx', type: 'examples', version: '1.0',
    validFrom: '2026-01-01', hash: '9be0…77d1',
  },
  {
    id: 'doc-rules-1-0', programId: 'studstartup', title: 'Правила стоп-факторов',
    key: 'kb/fasie/studstartup/rules_v1.docx', type: 'stop_rules', version: '1.0',
    validFrom: '2026-01-01', hash: 'c3d2…1a90',
  },
  {
    id: 'doc-reg-0-9', programId: 'studstartup', title: 'Положение о программе (прошлая очередь)',
    key: 'kb/fasie/studstartup/reg_v0.pdf', type: 'regulation', version: '0.9',
    validFrom: '2025-03-01', hash: '55aa…e310',
  },
];

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function todayIso(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

export interface DemoKbOptions {
  /** Хеш файла (hex sha256). По умолчанию — crypto.subtle; в тестах подменяется. */
  hashFile?: (file: File) => Promise<string>;
  /** Сегодняшняя дата ISO: от неё зависят статусы «Действует», «Архив» и «С …» (см. resolveKbStatuses). */
  today?: string;
}

/**
 * Статусы по дате вступления в силу («Действует с», valid_from). Новая редакция не вытесняет действующую,
 * пока её дата не наступила:
 * - дата позже today → «scheduled» («С <дата>»);
 * - среди вступивших в силу (validFrom <= today) самая поздняя редакция той же программы и типа → «active»;
 * - остальные вступившие в силу редакции того же типа → «archive».
 * При равной дате выигрывает запись, которая стоит раньше в списке (новые загрузки добавляются в начало).
 */
export function resolveKbStatuses(records: readonly KbDocRecord[], today: string): KbDocument[] {
  const inForce = (r: KbDocRecord) => r.validFrom <= today;
  return records.map((record, index) => {
    if (!inForce(record)) return { ...record, status: 'scheduled' };
    const superseded = records.some(
      (other, otherIndex) =>
        other.programId === record.programId &&
        other.type === record.type &&
        inForce(other) &&
        (other.validFrom > record.validFrom || (other.validFrom === record.validFrom && otherIndex < index)),
    );
    return { ...record, status: superseded ? 'archive' : 'active' };
  });
}

/** Демо-сервис в памяти: новый документ попадает в начало списка; дубль по хешу отклоняется; статусы — по дате. */
export function createDemoKbService(options: DemoKbOptions = {}): KbService {
  const hashFile = options.hashFile ?? sha256Hex;
  const today = options.today ?? todayIso();
  let records: KbDocRecord[] = [...DEMO_KB_RECORDS];
  let counter = 0;

  function forProgram(programId: string): KbDocument[] {
    return resolveKbStatuses(
      records.filter((d) => d.programId === programId),
      today,
    );
  }

  return {
    async listDocuments(programId) {
      return forProgram(programId);
    },
    async uploadDocument(input) {
      const hash = shortHash(await hashFile(input.file));
      if (records.some((d) => d.hash === hash)) return { ok: false, reason: 'duplicate_hash' };

      counter += 1;
      const record: KbDocRecord = {
        id: `doc-new-${counter}`,
        programId: input.programId,
        title: kbDocTypeOption(input.type).title,
        key: `kb/fasie/${input.programId}/${input.file.name}`,
        type: input.type,
        version: input.version,
        validFrom: input.validFrom,
        hash,
      };
      // Прежние редакции не меняются: статус «Архив» появится у них, когда наступит дата новой редакции.
      records = [record, ...records];
      const document = forProgram(input.programId).find((d) => d.id === record.id);
      if (!document) throw new Error(`Документ не найден после публикации: ${record.id}`);
      return { ok: true, document };
    },
  };
}
