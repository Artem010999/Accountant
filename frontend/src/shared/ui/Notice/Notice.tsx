import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './Notice.css';

// Инлайн-уведомление: три тона (предупреждение, информация, ошибка).
// Цвета и радиусы — только токены из tokens.css. Структура как карточки DesignSystem.dc.html:
// подложка тона, радиус карточки кабинета (22 px), заголовок, текст, кнопка-действие.
// Тексты задаёт экран; компонент ничего не добавляет от себя.

export type NoticeTone = 'warning' | 'info' | 'danger';

export interface NoticeAction {
  label: string;
  to: string;
}

export interface NoticeProps {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
  /** Кнопка-ссылка справа (маршрут приложения). */
  action?: NoticeAction;
  /** Если задано, справа показывается кнопка «Закрыть». */
  onDismiss?: () => void;
}

const ICONS: Record<NoticeTone, ReactNode> = {
  warning: (
    <path d="M10.3 4.2L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
  ),
  info: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01" />,
  danger: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6" />,
};

export function Notice({ tone, title, children, action, onDismiss }: NoticeProps) {
  const titleId = useId();
  const role = tone === 'danger' ? 'alert' : undefined;

  return (
    <section role={role} aria-labelledby={titleId} className={`notice notice--${tone}`}>
      <svg
        className="notice__icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICONS[tone]}
      </svg>
      <div className="notice__body">
        <p id={titleId} className="notice__title">
          {title}
        </p>
        {children && <p className="notice__text">{children}</p>}
      </div>
      {action && (
        <Link to={action.to} className="notice__action">
          {action.label}
        </Link>
      )}
      {onDismiss && (
        <button type="button" className="notice__close" aria-label="Закрыть" onClick={onDismiss}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </section>
  );
}
