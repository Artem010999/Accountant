import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import {
  KB_DEFAULT_PROGRAM,
  KB_DOC_TYPES,
  KB_PROGRAMS,
  createDemoKbService,
  formatRuDate,
  kbDocTypeOption,
  kbFileError,
  kbStatusLabel,
  kbStatusTone,
  type KbDocType,
  type KbDocument,
  type KbService,
} from '../../shared/data/adminKb';
import './AdminKB.css';

// Экран «База знаний» (/admin/kb). Эталон: design/project/AdminKB.dc.html.
// Тексты эталона — дословно. Форма загрузки, её валидация и сообщение о дубле хеша в эталоне не заданы
// (новые элементы, перечислены в отчёте G4).

export interface AdminKBProps {
  /** Сервис базы знаний. По умолчанию — демо-реализация в памяти (до G5). В тестах подменяется. */
  service?: KbService;
}

// Атрибут accept выбора файла: PDF и DOCX (правило проверки — kbFileError в shared/data/adminKb.ts).
const FILE_ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const SUCCESS_TEXT =
  'Документ опубликован. Паспорта, проверенные по прежней версии, не меняются — новая версия применится при следующей проверке.';

const DUPLICATE_TEXT = 'Такой файл уже загружен';

// Ошибка сети или сервиса при публикации. Текст не из эталона (состояния ошибки там нет).
const NETWORK_TEXT = 'Не удалось опубликовать документ. Попробуйте ещё раз.';

const DEFAULT_FORM = {
  type: 'regulation' as KbDocType,
  version: '1.1',
  validFrom: '2026-12-01',
};

interface KbFormValues {
  programId: string;
  type: KbDocType;
  version: string;
  validFrom: string;
  file: File | null;
}

type KbFormErrors = Partial<Record<'programId' | 'version' | 'validFrom' | 'file', string>>;

function validateForm(values: KbFormValues): KbFormErrors {
  const errors: KbFormErrors = {};
  const program = KB_PROGRAMS.find((p) => p.id === values.programId);
  if (!program || !program.enabled) errors.programId = 'Выберите программу';
  if (!values.version.trim()) errors.version = 'Укажите версию';
  if (!values.validFrom) errors.validFrom = 'Укажите дату начала действия';
  if (!values.file) errors.file = 'Выберите файл';
  else {
    const fileError = kbFileError(values.file);
    if (fileError) errors.file = fileError;
  }
  return errors;
}

const ERROR_KEYS: readonly (keyof KbFormErrors)[] = ['programId', 'version', 'validFrom', 'file'];

function isErrorKey(key: keyof KbFormValues): key is keyof KbFormErrors {
  return (ERROR_KEYS as readonly string[]).includes(key);
}

function withoutKey(errors: KbFormErrors, key: keyof KbFormErrors): KbFormErrors {
  const next = { ...errors };
  delete next[key];
  return next;
}

/** aria-атрибуты контрола с ошибкой; без ошибки — пусто. */
function errorAria(id: string, error: string | undefined) {
  return error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {};
}

interface KbFieldProps {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}

function KbField({ id, label, error, children }: KbFieldProps) {
  return (
    <div className="kb__field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <span id={`${id}-error`} className="kb__error">
          {error}
        </span>
      )}
    </div>
  );
}

export function AdminKB({ service }: AdminKBProps) {
  const [svc] = useState<KbService>(() => service ?? createDemoKbService());
  const uid = useId();
  const ids = {
    form: `${uid}-form`,
    program: `${uid}-program`,
    type: `${uid}-type`,
    version: `${uid}-version`,
    validFrom: `${uid}-valid-from`,
    file: `${uid}-file`,
  };

  const [program, setProgram] = useState(KB_DEFAULT_PROGRAM);
  const [docs, setDocs] = useState<KbDocument[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [values, setValues] = useState<KbFormValues>(() => ({
    programId: KB_DEFAULT_PROGRAM,
    ...DEFAULT_FORM,
    file: null,
  }));
  const [errors, setErrors] = useState<KbFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const aliveRef = useRef(false);
  const submittingRef = useRef(false);
  const programRef = useRef(program);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    programRef.current = program;
  }, [program]);

  useEffect(() => {
    let cancelled = false;
    svc.listDocuments(program).then((list) => {
      if (!cancelled) setDocs(list);
    });
    return () => {
      cancelled = true;
    };
  }, [svc, program]);

  function toggleForm() {
    if (formOpen) {
      setFormOpen(false);
      return;
    }
    setValues({ programId: program, ...DEFAULT_FORM, file: null });
    setErrors({});
    setFormError(null);
    setPublished(false);
    setFormOpen(true);
  }

  function updateField<K extends keyof KbFormValues>(key: K, value: KbFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (isErrorKey(key)) setErrors((e) => withoutKey(e, key));
    setFormError(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    pickFile(event.dataTransfer.files[0]);
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    // Файл сохраняется даже при ошибке: проверка повторяется при отправке и ошибка не теряется.
    const error = kbFileError(file) ?? undefined;
    setValues((v) => ({ ...v, file }));
    setErrors((e) => (error ? { ...withoutKey(e, 'file'), file: error } : withoutKey(e, 'file')));
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const found = validateForm(values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0 || !values.file) return;

    submittingRef.current = true;
    try {
      const result = await svc.uploadDocument({
        programId: values.programId,
        type: values.type,
        version: values.version.trim(),
        validFrom: values.validFrom,
        file: values.file,
      });
      if (!aliveRef.current) return;
      if (!result.ok) {
        setFormError(DUPLICATE_TEXT);
        return;
      }
      // Список перечитывается из сервиса: статусы считает сервис по дате вступления в силу (прежняя редакция
      // становится «Архив» только когда наступает дата новой).
      const list = await svc.listDocuments(values.programId);
      if (!aliveRef.current) return;
      if (programRef.current === values.programId) setDocs(list);
      setFormOpen(false);
      setPublished(true);
    } catch {
      if (aliveRef.current) setFormError(NETWORK_TEXT);
    } finally {
      submittingRef.current = false;
    }
  }

  const fileErrorAria = errorAria(ids.file, errors.file);

  return (
    <div className="kb">
      <div className="kb__head">
        <div className="kb__intro">
          <h1 className="kb__title">База знаний</h1>
          <p className="kb__lead">
            Правила программ, анкеты, вопросы и эталонные примеры. Из них Буха берёт вопросы и стоп-факторы.
          </p>
        </div>
        <button type="button" className="kb__add" onClick={toggleForm}>
          {formOpen ? 'Отмена' : 'Добавить документ'}
        </button>
      </div>

      <div role="tablist" aria-label="Программа" className="kb__tabs">
        {KB_PROGRAMS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === program}
            disabled={!p.enabled}
            className="kb__tab"
            onClick={() => setProgram(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {formOpen && (
        <form id={ids.form} className="kb__form" aria-labelledby={`${ids.form}-title`} noValidate onSubmit={handleSubmit}>
          <h2 id={`${ids.form}-title`} className="kb__form-title">
            Новый документ
          </h2>

          <div className="kb__grid">
            <KbField id={ids.program} label="Программа" error={errors.programId}>
              <select
                id={ids.program}
                className="kb__control"
                value={values.programId}
                {...errorAria(ids.program, errors.programId)}
                onChange={(e) => updateField('programId', e.target.value)}
              >
                {KB_PROGRAMS.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.enabled}>
                    {p.label}
                  </option>
                ))}
              </select>
            </KbField>

            <KbField id={ids.type} label="Тип">
              <select
                id={ids.type}
                className="kb__control"
                value={values.type}
                onChange={(e) => updateField('type', e.target.value as KbDocType)}
              >
                {KB_DOC_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </KbField>

            <KbField id={ids.version} label="Версия" error={errors.version}>
              <input
                id={ids.version}
                type="text"
                className="kb__control"
                value={values.version}
                {...errorAria(ids.version, errors.version)}
                onChange={(e) => updateField('version', e.target.value)}
              />
            </KbField>

            <KbField id={ids.validFrom} label="Действует с" error={errors.validFrom}>
              <input
                id={ids.validFrom}
                type="date"
                className="kb__control"
                value={values.validFrom}
                {...errorAria(ids.validFrom, errors.validFrom)}
                onChange={(e) => updateField('validFrom', e.target.value)}
              />
            </KbField>
          </div>

          <div className="kb__drop" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
            Перетащите PDF или DOCX-файл сюда или{' '}
            <button type="button" className="kb__drop-link" onClick={() => fileInputRef.current?.click()}>
              выберите
            </button>
            {values.file && !errors.file && <span className="kb__drop-file">Выбран файл: {values.file.name}</span>}
            <input
              ref={fileInputRef}
              id={ids.file}
              type="file"
              accept={FILE_ACCEPT}
              className="kb__file-input"
              aria-label="Файл документа"
              {...fileErrorAria}
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          {errors.file && (
            <span id={`${ids.file}-error`} className="kb__error">
              {errors.file}
            </span>
          )}

          <p className="kb__hint">Анкеты и правила хранятся отдельным файлом рядом с регламентом в формате PDF или DOCX.</p>

          <div className="kb__actions">
            <button type="submit" className="kb__publish">
              Опубликовать
            </button>
          </div>
          {formError && (
            <p role="alert" className="kb__alert">
              {formError}
            </p>
          )}
        </form>
      )}

      {published && (
        <p role="status" className="kb__success">
          {SUCCESS_TEXT}
        </p>
      )}

      <div className="kb__table-wrap">
        <table className="kb__table">
          <thead>
            <tr className="kb__thead-row">
              <th scope="col">Документ</th>
              <th scope="col">Тип</th>
              <th scope="col">Версия</th>
              <th scope="col">Действует с</th>
              <th scope="col">Хеш</th>
              <th scope="col">Статус</th>
            </tr>
          </thead>
          <tbody>
            {(docs ?? []).map((d) => (
              <tr key={d.id} className="kb__row">
                <td className="kb__td">
                  <span className="kb__doc">
                    <span className="kb__doc-title">{d.title}</span>
                    <code className="kb__doc-key">{d.key}</code>
                  </span>
                </td>
                <td className="kb__td">{kbDocTypeOption(d.type).short}</td>
                <td className="kb__td">{d.version}</td>
                <td className="kb__td">{formatRuDate(d.validFrom)}</td>
                <td className="kb__td kb__hash">{d.hash}</td>
                <td className="kb__td">
                  <span className={`kb__chip kb__chip--${kbStatusTone(d.status)}`}>{kbStatusLabel(d)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
