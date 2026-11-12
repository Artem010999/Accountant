import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { DEFAULT_PLAN_ID } from '../../shared/config/flags';
import { Link } from 'react-router-dom';
import { useCabinetShell } from '../../shared/layout/CabinetLayout';
import { planFeatures } from '../../shared/config/flags';
import { Notice } from '../../shared/ui/Notice/Notice';
import {
  filesPlan,
  SEED_FILES,
  SIZE_LIMIT_MB,
  claimsWord,
  extOf,
  kindFromExt,
  formatMb,
  formatToday,
  localFilesApi,
  sha256Hex,
  type FilesApi,
  type FilesPlanId,
  type ProjectFile,
  type UploadStatus,
} from './Files.model';
import './Files.css';

// Экран «Материалы проекта». Эталон: design/project/Files.dc.html.
// Загрузка идёт через FilesApi (по умолчанию локальная реализация; пайплайн подключается на G5).

export interface FilesProps {
  api?: FilesApi;
  /** Тариф проекта. По умолчанию «Профессиональный» — как в эталоне (10 файлов). */
  plan?: FilesPlanId;
  /**
   * Доступна ли загрузка документов (функция ai_parsing тарифа). По умолчанию — planFeatures() из flags.ts.
   * Передаётся явно, чтобы проверить состояние 402 при выключенной функции.
   */
  aiParsingEnabled?: boolean;
}

type ToastTone = 'success' | 'neutral' | 'warning' | 'danger';

interface Toast {
  tone: ToastTone;
  text: string;
  link?: { label: string; to: string };
}

const ACCEPT = '.pdf,.docx,.pptx,.png,.jpg,.jpeg,.tif,.tiff';

// Тексты окон 402 и BLOCKED_PROJECT_SWAP взяты из States.dc.html; на экране материалов они выводятся тостом.
const PAYWALL_TEXT =
  'Загрузка документов — на платном тарифе. На Базовом тарифе паспорт собирается по анкете. Чтобы разобрать презентацию и привязать факты к страницам, подключите «Профессиональный».';
const PAYWALL_TITLE = 'Загрузка документов — на платном тарифе';
const PAYWALL_BODY =
  'На Базовом тарифе паспорт собирается по анкете. Чтобы разобрать презентацию и привязать факты к страницам, подключите «Профессиональный».';
const SWAP_TITLE = 'Похоже, это материалы другого проекта';
// Текст инлайн-карточки придуман для экрана (короткий, на «вы»), в эталоне Files его нет.
const SWAP_BODY = 'Файл не сохранён: один аккаунт — один проект. Если это ошибка, напишите в поддержку.';

function toastForOutcome(status: UploadStatus, name: string): Toast {
  switch (status) {
    case 'accepted':
      return {
        tone: 'success',
        text: `${name} загружен. Буха разбирает его — новые факты появятся в паспорте через пару минут.`,
      };
    case 'duplicate':
      return { tone: 'warning', text: `${name} уже загружен — повторно не разбираем и в лимит не считаем.` };
    case 'FILE_QUOTA_EXCEEDED':
      return {
        tone: 'danger',
        text: 'Лимит файлов исчерпан. Удалите ненужный файл или перейдите на «Премиум».',
      };
    case 'PLAN_UPGRADE_REQUIRED':
      return { tone: 'warning', text: PAYWALL_TEXT, link: { label: 'Тарифы', to: '/billing' } };
    case 'BLOCKED_PROJECT_SWAP':
      return {
        tone: 'danger',
        text: `Похоже, это материалы другого проекта. Файл «${name}» не совпадает по смыслу с описанием Monetrix. Один аккаунт — один проект, поэтому мы его не сохранили.`,
      };
  }
}

function statusLabel(f: ProjectFile): string {
  if (f.st === 'parsing') return 'Разбираем…';
  return (f.st === 'ocr' ? 'Скан распознан · ' : '') + claimsWord(f.claims);
}

function rowMeta(f: ProjectFile): string {
  return `${f.pages ? `${f.pages} · ` : ''}${formatMb(f.mb)}`;
}

const EXT_CLASS: Record<ProjectFile['kind'], string> = {
  pdf: 'files__ext--pdf',
  scan: 'files__ext--scan',
  docx: 'files__ext--docx',
  other: 'files__ext--other',
};

export function Files({ api = localFilesApi, plan = DEFAULT_PLAN_ID, aiParsingEnabled }: FilesProps = {}) {
  // Отступы и зазор области из Files.dc.html (main: 36px 48px 64px, gap 28px). Маршрут /files не в ROUTE_SHELL.
  useCabinetShell({ mainPadding: '36px 48px 64px', mainGap: '28px' });

  const planData = filesPlan(plan);
  const fileLimit = planData.file_uploads_limit;
  const canUpload = aiParsingEnabled ?? planFeatures(planData.features).ai_parsing;

  const [files, setFiles] = useState<ProjectFile[]>(SEED_FILES);
  const [toast, setToast] = useState<Toast | null>(null);
  const [blockedNotice, setBlockedNotice] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Актуальный список для проверок внутри цикла загрузки (состояние React в замыкании устаревает).
  const filesRef = useRef<ProjectFile[]>(files);
  const nextIdRef = useRef(SEED_FILES.length + 1);

  const commit = (next: ProjectFile[]) => {
    filesRef.current = next;
    setFiles(next);
  };

  async function handleFiles(picked: File[]) {
    // Функция тарифа выключена: загрузка не отправляется, ответ — 402 (тост; карточка уже на экране).
    if (!canUpload) {
      setToast(toastForOutcome('PLAN_UPGRADE_REQUIRED', ''));
      return;
    }
    let last: Toast | null = null;
    try {
      for (const file of picked) {
        const sha256 = await sha256Hex(file);
        const sizeMb = file.size / 1048576;
        const { status } = await api.upload({ name: file.name, sizeMb, sha256, existing: filesRef.current, fileLimit });
        last = toastForOutcome(status, file.name);
        if (status === 'BLOCKED_PROJECT_SWAP') setBlockedNotice(true);
        if (status === 'accepted') {
          const ext = extOf(file.name);
          commit([
            ...filesRef.current,
            {
              id: nextIdRef.current++,
              name: file.name,
              ext,
              kind: kindFromExt(ext),
              mb: sizeMb,
              date: formatToday(),
              claims: 0,
              st: 'parsing',
              sha256,
            },
          ]);
        }
      }
    } catch {
      // Текст из user-flows F5 («Не получилось, повторить»): ошибка загрузки без потери уже загруженного.
      last = { tone: 'danger', text: 'Не получилось, повторить' };
    }
    if (last) setToast(last);
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    void handleFiles(picked);
  };

  const onDragOver = (e: DragEvent) => e.preventDefault();
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    void handleFiles(Array.from(e.dataTransfer.files));
  };

  const openPicker = () => inputRef.current?.click();

  const total = files.reduce((sum, f) => sum + f.mb, 0);
  const countPct = fileLimit > 0 ? `${Math.min(100, Math.round((files.length / fileLimit) * 100))}%` : '0%';
  const sizePct = `${Math.max(1, Math.round(total / 2))}%`;
  const atLimit = canUpload && files.length >= fileLimit;

  const preview = files.find((f) => f.id === previewId) ?? null;
  const confirmFile = files.find((f) => f.id === confirmId) ?? null;

  const removeConfirmed = () => {
    if (!confirmFile) return;
    commit(files.filter((f) => f.id !== confirmFile.id));
    setConfirmId(null);
    const lost = confirmFile.claims > 0;
    setToast({
      tone: 'warning',
      text: `Файл удалён. ${lost ? `${claimsWord(confirmFile.claims)} остались без источника.` : 'Место в лимите освободилось.'}`,
      link: lost ? { label: 'Проверить в паспорте', to: '/passport' } : undefined,
    });
  };

  const toastStyle: Record<ToastTone, string> = {
    success: 'files__toast--success',
    neutral: 'files__toast--neutral',
    warning: 'files__toast--warning',
    danger: 'files__toast--danger',
  };

  return (
    <>
      <div className="files__head">
        <div className="files__intro">
          <h1 className="files__title">Материалы проекта</h1>
          <p className="files__lead">Всё, из чего Буха собирает паспорт. Каждый факт в паспорте ссылается на файл и страницу отсюда.</p>
        </div>
        <button type="button" className="files__add" onClick={openPicker}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Добавить файлы
        </button>
      </div>

      {toast && (
        <div role="status" className={`files__toast ${toastStyle[toast.tone]}`}>
          <span className="files__toast-text">{toast.text}</span>
          {toast.link && (
            <Link to={toast.link.to} className="files__toast-link">
              {toast.link.label}
            </Link>
          )}
          <button type="button" className="files__icon-btn files__toast-close" onClick={() => setToast(null)} aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}

      {atLimit && (
        <Notice
          tone="warning"
          title={`Лимит файлов исчерпан: ${fileLimit} из ${fileLimit}`}
          action={plan === 'premium' ? undefined : { label: 'Тарифы', to: '/billing' }}
        >
          {plan === 'premium'
            ? 'Чтобы добавить новый файл, удалите ненужный. Повторно загруженные копии в лимит не считаются.'
            : `Чтобы добавить новый файл, удалите ненужный или подключите «Премиум»: там до ${filesPlan('premium').file_uploads_limit} файлов. Повторно загруженные копии в лимит не считаются.`}
        </Notice>
      )}

      {blockedNotice && (
        <Notice tone="danger" title={SWAP_TITLE} onDismiss={() => setBlockedNotice(false)}>
          {SWAP_BODY}
        </Notice>
      )}

      <section aria-label="Лимиты" className="files__limits">
        <div className="files__limit-card">
          <span className="files__limit-caption">Файлов</span>
          <span className="files__limit-value">
            {files.length} <span className="files__limit-of">из {fileLimit}</span>
          </span>
          <span role="progressbar" aria-valuemin={0} aria-valuemax={fileLimit} aria-valuenow={files.length} aria-label="Использовано файлов" className="files__bar">
            <span className="files__bar-fill" style={{ width: countPct }} />
          </span>
        </div>
        <div className="files__limit-card">
          <span className="files__limit-caption">Объём</span>
          <span className="files__limit-value">
            {formatMb(total)} <span className="files__limit-of">из {SIZE_LIMIT_MB} МБ</span>
          </span>
          <span role="progressbar" aria-valuemin={0} aria-valuemax={SIZE_LIMIT_MB} aria-valuenow={Math.round(total)} aria-label="Использовано места" className="files__bar">
            <span className="files__bar-fill" style={{ width: sizePct }} />
          </span>
        </div>
        <div className="files__plan-card">
          <span className="files__plan-name">Тариф «{planData.name}»</span>
          <span className="files__plan-text">PDF, DOCX, PPTX, сканы · до 25 МБ на файл. Дубли не занимают место в лимите.</span>
          {plan !== 'premium' && (
            <Link to="/billing" className="files__plan-link">
              Нужно больше — «Премиум», {filesPlan('premium').file_uploads_limit} файлов
            </Link>
          )}
        </div>
      </section>

      <section className="files__list">
        <div role="row" className="files__row files__row--head">
          <span>Файл</span>
          <span>Загружен</span>
          <span>Что нашла Буха</span>
          <span className="files__cell--end">Действия</span>
        </div>
        {files.map((f) => (
          <div role="row" key={f.id} className="files__row files__row--item">
            <span className="files__name">
              <span className={`files__ext ${EXT_CLASS[f.kind]}`}>{f.ext}</span>
              <span className="files__name-text">
                <span className="files__name-title">{f.name}</span>
                <span className="files__name-meta">{rowMeta(f)}</span>
              </span>
            </span>
            <span className="files__date">{f.date}</span>
            <span className={`files__status ${f.st === 'parsing' ? 'files__status--parsing' : 'files__status--ok'}`}>{statusLabel(f)}</span>
            <span className="files__actions">
              <button type="button" className="files__open" onClick={() => setPreviewId(f.id)}>
                Открыть
              </button>
              <button type="button" className="files__icon-btn" aria-label="Скачать файл" onClick={() => setToast({ tone: 'neutral', text: 'Скачивание началось.' })}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4v12M7 11l5 5 5-5" />
                  <path d="M4 20h16" />
                </svg>
              </button>
              <button type="button" className="files__icon-btn files__icon-btn--danger" aria-label="Удалить файл" onClick={() => setConfirmId(f.id)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                </svg>
              </button>
            </span>
          </div>
        ))}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          aria-label="Файлы для загрузки"
          onChange={onPick}
        />
        {canUpload ? (
          <>
            <button type="button" className="files__drop" onClick={openPicker} onDragOver={onDragOver} onDrop={onDrop}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 16V4M7 9l5-5 5 5" />
                <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
              </svg>
              Перетащите файлы сюда или <span className="files__drop-link">загрузите с устройства</span>
            </button>
            <p className="files__hint">Добавлять можно только материалы по проекту Monetrix: файлы о другом проекте система не примет.</p>
          </>
        ) : (
          <Notice tone="info" title={PAYWALL_TITLE} action={{ label: 'Тарифы', to: '/billing' }}>
            {PAYWALL_BODY}
          </Notice>
        )}
      </section>

      {preview && (
        <div className="files__overlay files__overlay--end">
          <div role="dialog" aria-label="Просмотр файла" className="files__drawer">
            <div className="files__drawer-head">
              <div className="files__drawer-title">
                <h2 className="files__drawer-name">{preview.name}</h2>
                <span className="files__drawer-meta">
                  {`${preview.ext} · ${preview.pages ? `${preview.pages} · ` : ''}${formatMb(preview.mb)} · загружен ${preview.date}`}
                </span>
              </div>
              <button type="button" className="files__close" onClick={() => setPreviewId(null)} aria-label="Закрыть">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="files__page-wrap">
              <div className="files__page">
                <span className="files__page-title" />
                <span className="files__page-line files__page-line--long" />
                <span className="files__page-line files__page-line--short" />
                <span className="files__page-fact">Подтверждённый факт со стр. 4</span>
              </div>
              <span className="files__page-count">Страница 4 из 15</span>
            </div>
            <div className="files__drawer-status">
              <span className="files__drawer-status-title">
                {preview.st === 'parsing' ? 'Буха ещё разбирает файл' : `Буха нашла ${claimsWord(preview.claims)}`}
              </span>
              <span className="files__drawer-status-text">
                Утверждения из этого файла подсвечены в паспорте. Нажмите на факт в паспорте, чтобы перейти к нужной странице.
              </span>
            </div>
            <div className="files__drawer-actions">
              <button
                type="button"
                className="files__btn-dark"
                onClick={() => {
                  setPreviewId(null);
                  setToast({ tone: 'neutral', text: 'Скачивание началось.' });
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4v12M7 11l5 5 5-5" />
                  <path d="M4 20h16" />
                </svg>
                Скачать
              </button>
              <Link to="/passport" className="files__drawer-link">
                Открыть факты в паспорте
              </Link>
            </div>
          </div>
        </div>
      )}

      {confirmFile && (
        <div className="files__overlay files__overlay--center">
          <div role="alertdialog" aria-label="Удаление файла" className="files__confirm">
            <h2 className="files__confirm-title">Удалить файл?</h2>
            <p className="files__confirm-text">
              <b className="files__confirm-name">{confirmFile.name}</b>
              {` пропадёт из материалов. ${
                confirmFile.claims
                  ? `${claimsWord(confirmFile.claims).replace(/^./, (c) => c.toUpperCase())} из него`
                  : 'Утверждения из него'
              } в паспорте останутся, но потеряют источник: Буха пометит их красным, и их нужно будет подтвердить заново или удалить.`}
            </p>
            <div className="files__confirm-actions">
              <button type="button" className="files__btn-outline" onClick={() => setConfirmId(null)}>
                Оставить
              </button>
              <button type="button" className="files__btn-danger" onClick={removeConfirmed}>
                Удалить файл
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
