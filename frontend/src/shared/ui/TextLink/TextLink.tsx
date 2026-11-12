import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './TextLink.css';

// Текстовая ссылка DesignSystem: 17 px, 600. Цвет — из глобального стиля ссылок (--color-link).
export interface TextLinkProps {
  /** Внутренний маршрут (react-router). */
  to?: string;
  /** Внешняя или якорная ссылка, если маршрут не задан. */
  href?: string;
  children: ReactNode;
}

export function TextLink({ to, href = '#', children }: TextLinkProps) {
  if (to) {
    return (
      <Link to={to} className="textlink">
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className="textlink">
      {children}
    </a>
  );
}
