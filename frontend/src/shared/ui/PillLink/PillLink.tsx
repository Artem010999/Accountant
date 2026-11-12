import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './PillLink.css';

// Кнопка-ссылка в форме пилюли: CTA лендинга, тарифов и входа. Размеры — из эталонов Main/Pricing/Auth.
export type PillLinkVariant = 'brand' | 'ink' | 'outline' | 'brand-outline';
/** nav — шапка сайта (48 px); sm — тариф (56 px); md — форма входа (60 px); lg — блок призыва (64 px); xl — hero (72 px). */
export type PillLinkSize = 'nav' | 'sm' | 'md' | 'lg' | 'xl';

export interface PillLinkProps {
  to: string;
  variant?: PillLinkVariant;
  size?: PillLinkSize;
  className?: string;
  children: ReactNode;
}

export function PillLink({ to, variant = 'brand', size = 'md', className, children }: PillLinkProps) {
  const classes = ['pill-link', `pill-link--${variant}`, `pill-link--${size}`, className ?? ''].filter(Boolean).join(' ');
  return (
    <Link to={to} className={classes}>
      {children}
    </Link>
  );
}
