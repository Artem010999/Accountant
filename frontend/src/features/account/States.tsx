import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './States.css';

// Экран «Блокировки и лимиты». Эталон: design/project/States.dc.html (без бокового меню, как в эталоне).
// Все пять окон статичны: в эталоне нет скрипта состояний, каждое окно — отдельный ответ сервера.

interface StateBlockProps {
  /** Ответ сервера, как в эталоне (код или описание). */
  code: string;
  /** Окно или баннер, который видит пользователь. */
  children: ReactNode;
}

function StateBlock({ code, children }: StateBlockProps) {
  return (
    <div className="states__block">
      <code className="states__code">{code}</code>
      {children}
    </div>
  );
}

export function States() {
  return (
    <div className="states">
      <main className="states__main">
        <div className="states__intro">
          <h1 className="states__title">Блокировки и лимиты</h1>
          <p className="states__lead">Окна, которые видит пользователь, когда бэкенд возвращает отказ. Подпись над каждым — ответ сервера.</p>
        </div>

        <div className="states__grid">
          <StateBlock code="BLOCKED_PROJECT_SWAP · близость 0,38">
            <div role="dialog" aria-labelledby="s1" className="states__dialog">
              <span className="states__icon states__icon--danger">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  <path d="M14 3v5h5" />
                  <path d="M9.5 12.5l5 5M14.5 12.5l-5 5" />
                </svg>
              </span>
              <h2 id="s1" className="states__dialog-title">Похоже, это материалы другого проекта</h2>
              <p className="states__text states__text--body">Файл «Startup_X_pitch.pdf» не совпадает по смыслу с описанием Monetrix. Один аккаунт — один проект, поэтому мы его не сохранили.</p>
              <p className="states__text states__text--note">Если это ошибка и файл про ваш проект — напишите в поддержку, мы проверим вручную.</p>
              <div className="states__actions">
                <Link to="/files" className="states__btn-dark">Загрузить другой файл</Link>
                <Link to="/support" className="states__btn-link">Написать в поддержку</Link>
              </div>
            </div>
          </StateBlock>

          <StateBlock code="403 USER_BANNED">
            <div role="dialog" aria-labelledby="s2" className="states__dialog">
              <span className="states__icon states__icon--neutral">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M5.6 5.6l12.8 12.8" />
                </svg>
              </span>
              <h2 id="s2" className="states__dialog-title">Доступ к аккаунту ограничен</h2>
              <p className="states__text states__text--body">Работа с проектом приостановлена администратором. Данные проекта сохранены.</p>
              <div className="states__actions">
                <Link to="/support" className="states__btn-dark">Связаться с поддержкой</Link>
                <Link to="/" className="states__btn-link">На главную</Link>
              </div>
            </div>
          </StateBlock>

          <StateBlock code="402 PLAN_UPGRADE_REQUIRED">
            <div role="dialog" aria-labelledby="s3" className="states__dialog">
              <span className="states__icon states__icon--brand">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <h2 id="s3" className="states__dialog-title">Загрузка документов — на платном тарифе</h2>
              <p className="states__text states__text--body">На Базовом тарифе паспорт собирается по анкете. Чтобы разобрать презентацию и привязать факты к страницам, подключите «Профессиональный».</p>
              <div className="states__actions">
                <Link to="/billing" className="states__btn-brand">Подключить за 990 ₽</Link>
                <Link to="/brief" className="states__btn-link">Ответить на анкету</Link>
              </div>
            </div>
          </StateBlock>

          <StateBlock code="429 FILE_QUOTA_EXCEEDED">
            <div role="dialog" aria-labelledby="s4" className="states__dialog">
              <span className="states__icon states__icon--warning">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 16V4M7 9l5-5 5 5" />
                  <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                </svg>
              </span>
              <h2 id="s4" className="states__dialog-title">Лимит файлов исчерпан: 10 из 10</h2>
              <p className="states__text states__text--body">Вы пытаетесь добавить ещё 2 файла. На «Премиуме» — до 50 файлов в проекте. Повторно загруженные копии в лимит не считаются.</p>
              <div className="states__actions">
                <Link to="/billing" className="states__btn-brand">Перейти на Премиум</Link>
                <Link to="/files" className="states__btn-link">Выбрать меньше файлов</Link>
              </div>
            </div>
          </StateBlock>

          <div className="states__block states__block--wide">
            <code className="states__code">Подписка закончилась · баннер в кабинете</code>
            <div role="status" className="states__banner">
              <span className="states__banner-dot" />
              <span className="states__banner-text">
                <b className="states__banner-strong">«Профессиональный» закончился 1 декабря.</b> Паспорт, файлы и экспорт на месте; загрузка новых файлов и проверка новизны отключены.
              </span>
              <Link to="/billing" className="states__banner-btn">Продлить за 841 ₽</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
