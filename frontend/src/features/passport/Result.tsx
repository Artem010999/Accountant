import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../../shared/ui/Logo/Logo';
import './Result.css';

// Экран «Итог проверки» (F8: допуск и чек-лист). Эталон: design/project/Result.dc.html.
// Логика повторяет его скрипт: переключатель статуса прототипа, чек-лист, согласование паспорта.

type Verdict = 'ok' | 'warn' | 'bad';

const VARIANTS: { id: Verdict; label: string }[] = [
  { id: 'ok', label: 'Допуск' },
  { id: 'warn', label: 'Уточнить' },
  { id: 'bad', label: 'Стоп' },
];

const HEROES: Record<Verdict, { title: string; text: string }> = {
  ok: {
    title: 'Можно готовить заявку',
    text: 'Формальные требования программы выполнены, все факты подтверждены документами.',
  },
  warn: {
    title: 'Нужно уточнить',
    text: 'Стоп-факторов нет, но часть фактов не подтверждена документами, а новизна описана не полностью. Закройте пункты чек-листа.',
  },
  bad: {
    title: 'Есть стоп-факторы',
    text: 'С текущими сведениями заявку не допустят к конкурсу. Исправьте пункты ниже и проверьте паспорт заново.',
  },
};

// Стоп-факторы видны только в варианте «Стоп».
const STOPS = [
  { text: 'Новизна не подтверждена: указан 1 аналог из 2, нет измеримого отличия.', block: 'Блок 6' },
  { text: 'Правообладатель РИД не совпадает с заявителем, порядок передачи прав не указан.', block: 'Блок 9' },
];

// Предупреждения видны в вариантах «Уточнить» и «Стоп».
const WARNINGS = [
  { text: 'Для «Студенческого стартапа» нужно подтвердить статус обучающегося.', block: 'Блок 1' },
  { text: 'В паспорте 3 факта без подтверждающих документов.', block: 'Блоки 7, 10' },
  { text: 'Проверка новизны пропущена после двух попыток.', block: 'Блок 6' },
];

const CHECKLIST = [
  { text: 'Загрузить справку об обучении в вузе', block: 'Блок 1' },
  { text: 'Приложить материалы двух фокус-групп и подтверждение выручки 10 000 ₽', block: 'Блок 7' },
  { text: 'Добавить второй аналог и способ измерить отличие', block: 'Блок 6' },
  { text: 'Проверить совпадение заявителя и правообладателя по свидетельству РИД', block: 'Блок 9' },
  { text: 'Приложить оригинал уведомления о статусе участника Сколково', block: 'Блок 10' },
];

const LEGEND: { tone: string; label: string; count: number }[] = [
  { tone: 'doc', label: 'Факты с документом', count: 6 },
  { tone: 'nodoc', label: 'Факты без документа', count: 3 },
  { tone: 'plan', label: 'Планы', count: 7 },
  { tone: 'hypothesis', label: 'Гипотезы', count: 2 },
  { tone: 'hearsay', label: 'Со слов команды', count: 4 },
];

// Доли полосы «Насколько паспорт подтверждён» — из inline-стилей эталона (flex: 6 / 3 / 7 / 2 / 4).
const STACK = [
  { tone: 'doc', flex: 6 },
  { tone: 'nodoc', flex: 3 },
  { tone: 'plan', flex: 7 },
  { tone: 'hypothesis', flex: 2 },
  { tone: 'hearsay', flex: 4 },
];

const exportHint = 'Скачать можно, когда все 10 блоков одобрены';

/** exportReady — все блоки и смета одобрены аудитом (ответ COMPLETED.export_ready). По умолчанию — нет. */
export function Result({ exportReady = false }: { exportReady?: boolean } = {}) {
  const [verdict, setVerdict] = useState<Verdict>('warn');
  const [approved, setApproved] = useState(false);
  const [checks, setChecks] = useState<boolean[]>([true, false, false, false, false]);

  const hero = HEROES[verdict];
  const doneCount = checks.filter(Boolean).length;

  function toggle(i: number) {
    setChecks(checks.map((c, j) => (j === i ? !c : c)));
  }

  return (
    <div className="result">
      <div className="result__head">
        <div className="result__head-left">
          <h1 className="result__title">Итог проверки</h1>
          <p className="result__meta">«Студенческий стартап» · проверено 8 ноября 2026 в 14:20</p>
        </div>
        <div role="group" aria-label="Вариант статуса для прототипа" className="result__switch">
          <span className="result__switch-label">Прототип:</span>
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={verdict === v.id}
              onClick={() => setVerdict(v.id)}
              className={verdict === v.id ? 'result__variant result__variant--on' : 'result__variant'}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <section className={`result__hero result__hero--${verdict}`}>
        <span className={`result__hero-icon result__hero-icon--${verdict}`}>
          {verdict === 'ok' && (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5 9-10" />
            </svg>
          )}
          {verdict === 'warn' && (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
              <path d="M12 7v6M12 17h.01" />
            </svg>
          )}
          {verdict === 'bad' && (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          )}
        </span>
        <div className="result__hero-text">
          <h2 className="result__hero-title">{hero.title}</h2>
          <p className="result__hero-desc">{hero.text}</p>
        </div>
        <Link to="/generating" className="result__recheck">Проверить заново</Link>
      </section>

      <div className="result__grid">
        <div className="result__main">
          <section className="result__panel">
            <div className="result__panel-head">
              <h2 className="result__panel-title">Стоп-факторы</h2>
              <span className="result__panel-note">Блокируют подачу</span>
            </div>
            {verdict !== 'bad' && (
              <p className="result__ok-line">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5 9-10" />
                </svg>
                Формальных стоп-факторов не найдено
              </p>
            )}
            <ul className="result__list">
              {verdict === 'bad' && STOPS.map((s) => (
                <li key={s.text} className="result__item result__item--stop">
                  <span className="result__dot result__dot--stop" />
                  <span className="result__item-text result__item-text--stop">{s.text}</span>
                  <Link to="/passport" className="result__item-link">{s.block}</Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="result__panel">
            <div className="result__panel-head">
              <h2 className="result__panel-title">Предупреждения</h2>
              <span className="result__panel-note">Не блокируют, но эксперт спросит</span>
            </div>
            <ul className="result__list">
              {verdict !== 'ok' && WARNINGS.map((w) => (
                <li key={w.text} className="result__item result__item--warn">
                  <span className="result__dot result__dot--warn" />
                  <span className="result__item-text result__item-text--warn">{w.text}</span>
                  <Link to="/passport" className="result__item-link">{w.block}</Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="result__panel result__panel--checklist">
            <div className="result__check-head">
              <BrandMark size={40} />
              <div className="result__check-head-text">
                <h2 className="result__check-title">Что сделать перед подачей</h2>
                <span className="result__check-count">Сделано {doneCount} из {CHECKLIST.length}</span>
              </div>
            </div>
            <p className="result__check-lead">
              Паспорт собран по всем блокам. Ключевые функции MVP и свидетельство на программу подтверждены презентацией. Для допуска нужны документы о статусе обучения и о заявленной выручке, а также сравнение со вторым аналогом.
            </p>
            <ul className="result__checks">
              {CHECKLIST.map((c, i) => (
                <li key={c.text} className="result__check">
                  <input
                    type="checkbox"
                    checked={checks[i]}
                    onChange={() => toggle(i)}
                    aria-label={c.text}
                    className="result__checkbox"
                  />
                  <span className={checks[i] ? 'result__check-text result__check-text--done' : 'result__check-text'}>{c.text}</span>
                  <Link to="/passport" className="result__check-link">{c.block}</Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="result__side">
          <section className="result__panel result__panel--confirm">
            <h2 className="result__side-title">Насколько паспорт подтверждён</h2>
            <div aria-hidden="true" className="result__stack">
              {STACK.map((s) => (
                <span key={s.tone} className={`result__seg result__seg--${s.tone}`} style={{ flex: s.flex }} />
              ))}
            </div>
            <ul className="result__legend">
              {LEGEND.map((l) => (
                <li key={l.tone} className="result__legend-item">
                  <span className={`result__swatch result__swatch--${l.tone}`} />
                  <span className="result__legend-name">{l.label}</span>
                  <b>{l.count}</b>
                </li>
              ))}
            </ul>
            <Link to="/passport" className="result__link">Открыть паспорт</Link>
          </section>

          <section className="result__panel result__panel--passport">
            <h2 className="result__side-subtitle">Паспорт</h2>
            {!approved && (
              <>
                <p className="result__approve-note">Согласуйте версию, когда всё проверите. Любая правка потом снимет согласование с изменённого поля.</p>
                <button type="button" onClick={() => setApproved(true)} className="result__approve">Согласовать паспорт</button>
              </>
            )}
            {approved && (
              <p className="result__approved">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5 9-10" />
                </svg>
                Согласован 8 ноября, версия 3
              </p>
            )}
            <div className="result__downloads">
              <button type="button" className="result__download" disabled={!exportReady} title={exportHint}>Скачать DOCX</button>
              <button type="button" className="result__download" disabled={!exportReady} title={exportHint}>Скачать PDF</button>
            </div>
            <p className="result__fine">Скачивание не означает подачу. Заявка подаётся в системе фонда.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
