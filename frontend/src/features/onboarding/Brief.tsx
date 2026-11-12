import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from '../../shared/ui/Logo/Logo';
import { OnboardingHeader } from './OnboardingHeader';
import './common.css';
import './Brief.css';

// Стартовый бриф — design/project/Brief.dc.html. Три состояния: «есть файлы?» (ask),
// «Материалы загружены» (files) и анкета (form). Тариф «Базовый» закрывает загрузку пейволлом.

type Step = 'ask' | 'files' | 'form';
type Plan = 'free' | 'pro';
type FileKind = 'ready' | 'scan' | 'duplicate';

interface UploadedFile {
  id: string;
  name: string;
  meta: string;
  kind: FileKind;
}

// Состояние прототипа из эталона: один файл распознан, один скан, один дубликат (не считается в лимит).
const INITIAL_FILES: UploadedFile[] = [
  { id: 'f1', name: 'Monetrix_presentation_02.11.pdf', meta: '15 страниц · 4,2 МБ', kind: 'ready' },
  { id: 'f2', name: 'Svidetelstvo_RID_scan.pdf', meta: 'Скан · 2 страницы', kind: 'scan' },
  { id: 'f3', name: 'Monetrix_presentation_02.11 (1).pdf', meta: 'Этот файл уже загружен — повторно не разбираем и в лимит не считаем', kind: 'duplicate' },
];

const FILE_LIMIT = 10;

const QUESTIONS = [
  { id: 'q1', n: 1, q: 'Какую проблему решает проект и для кого?', ex: 'Сведения о мерах поддержки распределены между разными источниками; пользователю трудно собрать последовательность действий.' },
  { id: 'q2', n: 2, q: 'Что делает продукт?', ex: 'Единый профиль потребности, проверяемый справочник, подготовка черновика обращения и передача сложного вопроса координатору.' },
  { id: 'q3', n: 3, q: 'Что уже сделано, а что в планах?', ex: 'Есть макеты интерфейса; рабочий прототип планируется к концу первого этапа.' },
  { id: 'q4', n: 4, q: 'Кто в команде и чем занимается?', ex: 'Иван Иванов — руководитель проекта и продуктовая аналитика; разработчик — бэкенд и ИИ-модуль.' },
];

export function Brief() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('ask');
  const [plan, setPlan] = useState<Plan>('pro');
  const [files, setFiles] = useState<UploadedFile[]>(INITIAL_FILES);

  const free = plan === 'free';
  // На Базовом тарифе ветки «файлы» нет: показываем вопрос.
  const current: Step = free && step === 'files' ? 'ask' : step;
  const canUpload = !free;
  const used = files.filter((f) => f.kind !== 'duplicate').length;
  const submitLabel = current === 'files' ? 'Собрать паспорт по файлам' : 'Собрать паспорт';

  // Валидация анкеты — нативная (required у вопросов): без ответов переход не происходит.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate('/generating');
  };

  const removeFile = (id: string) => setFiles((list) => list.filter((f) => f.id !== id));

  return (
    <div className="ob-page">
      <OnboardingHeader
        current={2}
        profileLink="/onboarding"
        trailing={
          <div role="group" aria-label="Тариф для прототипа" className="brief-proto">
            <span className="brief-proto__label">Прототип:</span>
            <button type="button" aria-pressed={free} onClick={() => setPlan('free')} className="brief-proto__btn">
              Базовый
            </button>
            <button type="button" aria-pressed={!free} onClick={() => setPlan('pro')} className="brief-proto__btn">
              Профи
            </button>
          </div>
        }
      />

      <main className="brief-main">
        <form className="brief-form" onSubmit={onSubmit}>
          {current === 'ask' && (
            <>
              <div className="brief-heading">
                <h1 className="ob-title">Есть материалы о проекте?</h1>
                <p className="ob-lead brief-heading__lead">Презентация, описание, бизнес-план, свидетельство на РИД — загрузите всё, что есть. Буха сама найдёт факты и внесёт их в паспорт, а чего не хватит, спросит потом.</p>
              </div>

              <section className="brief-ask">
                {canUpload && (
                  <button type="button" onClick={() => setStep('files')} className="brief-drop">
                    <span className="brief-drop__icon">
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 16V4M7 9l5-5 5 5" />
                        <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                      </svg>
                    </span>
                    <span className="brief-drop__title">Перетащите файлы сюда</span>
                    <span className="brief-drop__or">
                      или <span className="brief-drop__link">загрузите с устройства</span>
                    </span>
                    <span className="brief-drop__hint">PDF, DOCX, PPTX, сканы — до 10 файлов</span>
                  </button>
                )}

                {free && (
                  <div className="brief-locked">
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="4" y="10" width="16" height="11" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                    <h2 className="brief-locked__title">Разбор документов — на тарифе «Профессиональный»</h2>
                    <p className="brief-locked__text">Буха прочитает презентацию, найдёт факты и привяжет каждый к странице. На Базовом тарифе паспорт собирается по анкете.</p>
                    <Link to="/billing" className="brief-locked__cta">
                      Подключить за 990 ₽
                    </Link>
                  </div>
                )}

                <aside className="brief-aside">
                  <BrandMark size={48} />
                  <h2 className="brief-aside__title">Файлов пока нет?</h2>
                  <p className="brief-aside__text">Это нормально. Ответьте на несколько вопросов о проекте — займёт минут 10.</p>
                  <button type="button" onClick={() => setStep('form')} className="brief-aside__btn">
                    У меня нет файлов
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </aside>
              </section>
            </>
          )}

          {current === 'files' && (
            <>
              <div className="brief-heading">
                <h1 className="ob-title">Материалы загружены</h1>
                <p className="ob-lead brief-heading__lead">Этого достаточно, чтобы собрать паспорт. Анкету заполнять не нужно: если в документах чего-то не хватит, Буха соберёт вопросы в разделе «Пробелы».</p>
              </div>

              <section className="brief-files">
                <ul className="brief-files__list">
                  {files.map((file) => (
                    <FileRow key={file.id} file={file} onRemove={() => removeFile(file.id)} />
                  ))}
                </ul>
                <button type="button" className="brief-files__add">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Добавить ещё файл <span className="brief-files__count">· использовано {used} из {FILE_LIMIT}</span>
                </button>
              </section>
            </>
          )}

          {current === 'form' && (
            <>
              <div className="brief-heading">
                <h1 className="ob-title">Расскажите о проекте</h1>
                <p className="ob-lead brief-heading__lead">
                  Отвечайте как получится, коротко — тоже хорошо.{' '}
                  {canUpload && (
                    <button type="button" onClick={() => setStep('ask')} className="brief-form__upload-link">
                      Нашлись файлы? Загрузить
                    </button>
                  )}
                </p>
              </div>

              <section className="brief-questions">
                {QUESTIONS.map((item) => (
                  <div key={item.id} className="brief-question">
                    <label htmlFor={item.id} className="brief-question__label">
                      {item.n}. {item.q}
                      <span aria-hidden="true" className="ob-required"> *</span>
                    </label>
                    <textarea id={item.id} className="ob-textarea brief-textarea" required aria-required="true" rows={3} />
                    <details>
                      <summary className="brief-question__summary">Как обычно отвечают</summary>
                      <p className="brief-question__example">{item.ex}</p>
                    </details>
                  </div>
                ))}

                <div className="brief-extra">
                  <label htmlFor="extra" className="brief-extra__label">
                    Что ещё важно знать о проекте?
                  </label>
                  <span className="brief-extra__hint">Всё, что не поместилось в вопросы выше: пилоты, партнёры, награды, планы, сомнения.</span>
                  <textarea
                    id="extra"
                    className="ob-textarea brief-textarea brief-textarea--extra"
                    rows={5}
                    placeholder="Например: в октябре договорились о пилоте с центром соцподдержки, письмо пока не подписано"
                  />
                </div>
              </section>
            </>
          )}

          <div className="brief-footer">
            {current === 'form' && (
              <p className="brief-legend">
                <span className="ob-required">*</span> — обязательные вопросы
              </p>
            )}
            <div className="brief-footer__actions">
              {current === 'ask' && (
                <Link to="/onboarding" className="brief-back">
                  Назад
                </Link>
              )}
              {current !== 'ask' && (
                <button type="button" onClick={() => setStep('ask')} className="brief-back brief-back--button">
                  Назад
                </button>
              )}
              {current !== 'ask' && (
                <button type="submit" className="ob-btn-primary">
                  {submitLabel}
                </button>
              )}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

interface FileRowProps {
  file: UploadedFile;
  onRemove: () => void;
}

// Строка файла: иконка PDF, имя и подпись, статус (распознан / скан / дубликат), удаление.
function FileRow({ file, onRemove }: FileRowProps) {
  const isDuplicate = file.kind === 'duplicate';
  return (
    <li className={`brief-file${isDuplicate ? ' brief-file--duplicate' : ''}`}>
      <span className={`brief-file__chip brief-file__chip--${file.kind}`}>PDF</span>
      <span className="brief-file__info">
        <span className="brief-file__name">{file.name}</span>
        <span className={`brief-file__meta${isDuplicate ? ' brief-file__meta--warn' : ''}`}>{file.meta}</span>
      </span>
      {file.kind === 'ready' && <span className="brief-file__status brief-file__status--ready">Текст распознан</span>}
      {file.kind === 'scan' && (
        <span className="brief-file__status brief-file__status--scan">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3F3F46" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 9 9" />
          </svg>
          Распознаём скан
        </span>
      )}
      {isDuplicate ? (
        <button type="button" onClick={onRemove} className="brief-file__remove-text">
          Убрать
        </button>
      ) : (
        <button type="button" aria-label="Удалить файл" onClick={onRemove} className="brief-file__delete">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </li>
  );
}
