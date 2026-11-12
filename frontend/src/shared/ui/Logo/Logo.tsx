import { Link } from 'react-router-dom';
import './Logo.css';

// Совёнок из DesignSystem.dc.html: квадрат 40x40 с радиусом 12 и фигуры. Цвета — классы из tokens.css.
export function BrandMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="logo-mark">
      <rect width="40" height="40" rx="12" className="logo-mark__tile" />
      <path d="M7 7 L12 11 M33 7 L28 11" className="logo-mark__brow" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx="13.5" cy="18" r="7" className="logo-mark__eye" />
      <circle cx="26.5" cy="18" r="7" className="logo-mark__eye" />
      <circle cx="15" cy="17" r="3" className="logo-mark__pupil" />
      <circle cx="28" cy="17" r="3" className="logo-mark__pupil" />
      <path d="M17.5 27 L20 31 L22.5 27 Z" className="logo-mark__beak" />
    </svg>
  );
}

export type LogoVariant = 'hero' | 'cabinet' | 'admin';

export interface LogoProps {
  /** hero — заставка дизайн-системы (88 px + «Буха» + «Паспорт»); cabinet — шелл кабинета (34 px); admin — шелл админки (32 px, тёмный, с бейджем). */
  variant?: LogoVariant;
  /** Если задан, логотип — ссылка на маршрут. */
  to?: string;
  ariaLabel?: string;
}

const MARK_SIZE: Record<LogoVariant, number> = {
  hero: 88,
  cabinet: 34,
  admin: 32,
};

export function Logo({ variant = 'hero', to, ariaLabel }: LogoProps) {
  const className = `logo logo--${variant}`;
  const content = (
    <>
      <BrandMark size={MARK_SIZE[variant]} />
      <span className="logo__word">Буха</span>
      {variant === 'hero' && <span className="logo__product">Паспорт</span>}
      {variant === 'admin' && <span className="logo__badge">админ</span>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
