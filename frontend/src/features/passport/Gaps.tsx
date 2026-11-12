import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCabinetShell } from '../../shared/layout/CabinetLayout';
import './Gaps.css';

// Экран «Закроем пробелы» (дозаполнение пробелов F6 + проверка новизны F7).
// Эталон: design/project/Gaps.dc.html. Логика повторяет его скрипт (DCLogic: pick / submit / next / tryNovelty).

interface GapItem {
  section: string;
  title: string;
  /** Пункт новизны (блок 6): не вопрос, а форма сравнения с аналогами. */
  novelty?: boolean;
  question: string;
  criterion: string;
  example: string;
  /** Текст в поле при открытии пробела (как в эталоне). */
  weak: string;
  /** Пример, который подставляется после отказа валидатора. Пустой — отказа не будет. */
  good: string;
  reject: string;
  claimA: string;
  claimB: string;
}

const GAPS: GapItem[] = [
  {
    section: 'Блок 2 · Команда',
    title: 'Состав команды и роли',
    question: 'Кто в команде и за что отвечает каждый?',
    criterion: 'роли распределены, у ключевых участников есть релевантный опыт.',
    example: 'Иванов И. И. — руководитель проекта, отвечает за продукт и работу с пользователями; Петров П. П. — разработчик, отвечает за бэкенд и интеграции.',
    weak: '',
    good: '',
    reject: '',
    claimA: 'Иванов И. И. — руководитель проекта и продуктовая аналитика',
    claimB: 'Разработчика планируем привлечь на первом этапе гранта',
  },
  {
    section: 'Блок 8 · Юрлица',
    title: 'Юридическое лицо',
    question: 'Есть ли у проекта ООО или ИП? Если нет — когда планируете регистрацию?',
    criterion: 'указано юрлицо с ИНН и ОГРН или отмечено, что оно будет создано при победе.',
    example: 'Юридическое лицо не зарегистрировано; ООО будет создано после победы в конкурсе.',
    weak: '',
    good: '',
    reject: '',
    claimA: 'Юридическое лицо пока не зарегистрировано',
    claimB: 'ООО будет создано после победы в конкурсе',
  },
  {
    section: 'Блок 5 · Стадия и задел',
    title: 'Что работает в MVP',
    question: 'Какие функции демонстрируются в актуальном MVP и какая сейчас стадия разработки?',
    criterion: 'отделено то, что работает на реальных данных, от того, что в разработке.',
    example: 'На текущем этапе разработан рабочий прототип веб-сервиса (версия 0.2), протестированный на 2 фокус-группах…',
    weak: 'Ну MVP уже есть, всё работает.',
    good: 'В MVP версии 0.3 работают финансовый профиль и ручной ввод операций. Импорт выписок и сценарные расчёты планируются на первом этапе гранта.',
    reject: 'Уточните, какие именно функции работают сейчас и какая версия. Фраза «всё работает» не проверяема.',
    claimA: 'В MVP версии 0.3 работают финансовый профиль и ручной ввод операций',
    claimB: 'Импорт выписок и сценарные расчёты планируются на первом этапе гранта',
  },
  {
    section: 'Блок 9 · Права и РИД',
    title: 'Правообладатель',
    question: 'Кто правообладатель программы «Монетрикс» (№ 2026618524) и совпадает ли он с заявителем?',
    criterion: 'правообладатель РИД совпадает с заявителем или указан порядок передачи прав.',
    example: 'Правообладатель свидетельства — Иванов И. И., он же заявитель. После регистрации ООО права будут переданы по договору отчуждения.',
    weak: 'Наши права.',
    good: 'Правообладатель свидетельства № 2026618524 — Иванов И. И., он же заявитель. Права будут переданы ООО после его регистрации.',
    reject: 'Укажите конкретного правообладателя из свидетельства: человека или организацию.',
    claimA: 'Правообладатель свидетельства № 2026618524 — Иванов И. И., он же заявитель',
    claimB: 'Права будут переданы ООО после его регистрации',
  },
  {
    section: 'Блок 6 · Аналоги',
    title: 'Сравнение с аналогами',
    novelty: true,
    question: '',
    criterion: '',
    example: '',
    weak: '',
    good: '',
    reject: '',
    claimA: '',
    claimB: '',
  },
];

const NOVELTY_INDEX = GAPS.length - 1;
const START_INDEX = 2;
const ATTEMPT_LIMIT = 2;

type Phase = 'idle' | 'rejected' | 'done';

export function Gaps() {
  const [idx, setIdx] = useState(START_INDEX);
  const [closed, setClosed] = useState<boolean[]>([true, true, false, false, false]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [answer, setAnswer] = useState(GAPS[START_INDEX].weak);
  const [attempts, setAttempts] = useState(0);

  const cur = GAPS[idx];
  const closedCount = closed.filter(Boolean).length;
  // Счётчик «Пробелы» в меню кабинета = число открытых пробелов (эталон: 3 при 2 закрытых из 5).
  useCabinetShell({ gapsCount: closed.length - closedCount });
  const isNovelty = Boolean(cur.novelty);
  const accepted = phase === 'done' || closed[idx];
  const showInput = !isNovelty && !accepted;
  const isRejected = phase === 'rejected';
  const isAccepted = !isNovelty && accepted;
  const attemptShown = Math.min(attempts + 1, ATTEMPT_LIMIT);
  const canSkip = attempts >= ATTEMPT_LIMIT;

  function pick(i: number) {
    setIdx(i);
    setPhase(closed[i] ? 'done' : 'idle');
    setAnswer(GAPS[i].weak);
  }

  function submit() {
    if (phase === 'idle' && cur.good) {
      setPhase('rejected');
      setAnswer(cur.good);
      return;
    }
    setClosed(closed.map((c, i) => (i === idx ? true : c)));
    setPhase('done');
  }

  function next() {
    const n = closed.findIndex((c, i) => !c && i !== idx);
    pick(n === -1 ? NOVELTY_INDEX : n);
  }

  return (
    <div className="gaps">
      <div className="gaps__head">
        <div className="gaps__head-left">
          <h1 className="gaps__title">Закроем пробелы</h1>
          <p className="gaps__lead">Без этих сведений паспорт не пройдёт проверку программы.</p>
        </div>
        <div className="gaps__progress">
          <span className="gaps__progress-label">Закрыто {closedCount} из {GAPS.length}</span>
          <span className="gaps__bar" aria-hidden="true">
            <span className="gaps__bar-fill" style={{ width: `${(closedCount / GAPS.length) * 100}%` }} />
          </span>
        </div>
      </div>

      <div className="gaps__body">
        <ol aria-label="Список пробелов" className="gaps__list">
          {GAPS.map((g, i) => {
            const isCur = i === idx;
            const isClosed = closed[i];
            const dotMod = isClosed ? 'done' : g.novelty ? 'novelty' : 'open';
            const status = isClosed ? 'Закрыт' : g.novelty ? 'Нужно 2 аналога' : 'Ожидает ответа';
            return (
              <li key={g.title}>
                <button
                  type="button"
                  onClick={() => pick(i)}
                  aria-current={isCur ? 'step' : 'false'}
                  className="gaps__item-btn"
                >
                  <span className={`gaps__dot gaps__dot--${dotMod}`} />
                  <span className="gaps__item-text">
                    <span className="gaps__item-section">{g.section}</span>
                    <span className="gaps__item-title">{g.title}</span>
                    <span className="gaps__item-status">{status}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <section className="gaps__main">
          {!isNovelty && (
            <div className="gaps__card">
              <h2 className="gaps__question">{cur.question}</h2>

              <div className="gaps__criterion">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" className="gaps__criterion-icon">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5M12 8h.01" />
                </svg>
                <span className="gaps__criterion-text">
                  <b className="gaps__criterion-lead">Что проверяет фонд:</b> {cur.criterion}
                </span>
              </div>

              <details>
                <summary className="gaps__summary">Как обычно пишут</summary>
                <p className="gaps__example">{cur.example}</p>
              </details>

              {showInput && (
                <div className="gaps__field">
                  <label htmlFor="answer" className="gaps__label">Ваш ответ</label>
                  <textarea
                    id="answer"
                    rows={5}
                    className="gaps__textarea"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                </div>
              )}

              {isRejected && (
                <div role="alert" className="gaps__alert">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="gaps__alert-icon">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5M12 16h.01" />
                  </svg>
                  <span className="gaps__alert-text">
                    <b className="gaps__alert-lead">Ответ пока не закрывает вопрос.</b> {cur.reject} Мы подставили пример исправленного ответа.
                  </span>
                </div>
              )}

              {isAccepted && (
                <div className="gaps__accepted">
                  <span className="gaps__accepted-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                    Записано в паспорт
                  </span>
                  <p className="gaps__claims">
                    <span className="gaps__claim gaps__claim--a">{cur.claimA}</span>. <span className="gaps__claim gaps__claim--b">{cur.claimB}</span>.
                  </p>
                  <span className="gaps__accepted-note">Серым — со слов команды, без документа. Синим — план. Тип можно поменять в паспорте.</span>
                </div>
              )}

              <div className="gaps__actions">
                {showInput && (
                  <button type="button" onClick={submit} className="gaps__cta">Отправить ответ</button>
                )}
                {isAccepted && (
                  <button type="button" onClick={next} className="gaps__cta">Следующий вопрос</button>
                )}
                <Link to="/passport" className="gaps__later">Вернуться позже</Link>
              </div>
            </div>
          )}

          {isNovelty && (
            <div className="gaps__card gaps__card--novelty">
              <div className="gaps__chips">
                <span className="gaps__chip">Блок 6 · Аналоги и новизна</span>
                <span className="gaps__chip gaps__chip--stop">Сборка остановлена</span>
                <span className="gaps__attempt">Попытка {attemptShown} из {ATTEMPT_LIMIT}</span>
              </div>

              <h2 className="gaps__question">Нужно сравнение минимум с двумя аналогами</h2>
              <p className="gaps__novelty-text">
                По правилам ФСИ новизну подтверждают сравнением с аналогами по конкретным параметрам и измеримым отличием. Сейчас в материалах найден один аналог и нет параметров сравнения.
              </p>

              <div className="gaps__table-wrap">
                <table className="gaps__table">
                  <thead>
                    <tr>
                      <th scope="col">Аналог</th>
                      <th scope="col">Параметр</th>
                      <th scope="col">У аналога</th>
                      <th scope="col">У вас</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><input aria-label="Аналог 1" defaultValue="Приложение учёта расходов" className="gaps__input" /></td>
                      <td><input aria-label="Параметр 1" defaultValue="Источник данных" className="gaps__input" /></td>
                      <td><input aria-label="Значение у аналога 1" defaultValue="Ручной ввод" className="gaps__input" /></td>
                      <td><input aria-label="Ваше значение 1" defaultValue="Ручной ввод и API брокеров" className="gaps__input" /></td>
                    </tr>
                    <tr>
                      <td><input aria-label="Аналог 2" placeholder="Название" className="gaps__input gaps__input--todo" /></td>
                      <td><input aria-label="Параметр 2" placeholder="Что сравниваем" className="gaps__input" /></td>
                      <td><input aria-label="Значение у аналога 2" placeholder="Значение" className="gaps__input" /></td>
                      <td><input aria-label="Ваше значение 2" placeholder="Значение" className="gaps__input" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="gaps__field gaps__field--tight">
                <label htmlFor="proto" className="gaps__label">Как измерите отличие?</label>
                <textarea
                  id="proto"
                  rows={3}
                  placeholder="Например: одинаковый набор из 100 тестовых сценариев для обоих подходов; считаем долю правильно распознанных полей"
                  className="gaps__proto"
                />
              </div>

              {canSkip && (
                <div role="status" className="gaps__notice">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="gaps__notice-icon">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5M12 16h.01" />
                  </svg>
                  <span>Сравнение всё ещё неполное. Можно продолжить без него — тогда новизна попадёт в итоговый чек-лист, а блок 6 останется «на проверке».</span>
                </div>
              )}

              <div className="gaps__actions">
                <button type="button" onClick={() => setAttempts(attempts + 1)} className="gaps__cta">Проверить сравнение</button>
                {canSkip && (
                  <Link to="/result" className="gaps__skip">Продолжить без сравнения</Link>
                )}
              </div>
              <p className="gaps__fine">На тарифе «Базовый» этот шаг пропускается, а в чек-листе появляется пометка о непроверенной новизне.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
