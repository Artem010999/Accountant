import type { ReactNode } from 'react';
import './Card.css';

// Три варианта из дизайн-системы: контурная карточка (22 px), серая подложка (28 px), тёмная терракота (28 px).
export type CardVariant = 'outline' | 'muted' | 'dark';

export interface CardProps {
  variant?: CardVariant;
  className?: string;
  children: ReactNode;
}

export function Card({ variant = 'outline', className, children }: CardProps) {
  const classes = ['card', `card--${variant}`, className ?? ''].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}
