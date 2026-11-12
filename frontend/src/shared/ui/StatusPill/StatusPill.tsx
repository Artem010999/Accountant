import type { ReactNode } from 'react';
import './StatusPill.css';

// Статусы поля («Нужна проверка», «Подтверждено», «Согласовано») и допуска («Можно готовить заявку» и т.д.).
export type PillTone = 'warning' | 'info' | 'success' | 'danger';

export interface StatusPillProps {
  tone: PillTone;
  /** sm — 13 px (DesignSystem), md — 14 px (шапка паспорта). */
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function StatusPill({ tone, size = 'sm', children }: StatusPillProps) {
  return (
    <span className={`pill pill--${tone} pill--${size}`} data-tone={tone}>
      {children}
    </span>
  );
}
