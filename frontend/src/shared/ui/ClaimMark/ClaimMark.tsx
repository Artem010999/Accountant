import type { ReactNode } from 'react';
import './ClaimMark.css';

// Язык утверждений: тип различается цветом фона и стилем линии (читается без цвета).
export type ClaimKind = 'fact-doc' | 'fact-no-doc' | 'plan' | 'hypothesis' | 'hearsay' | 'lost';

export interface ClaimMarkProps {
  kind: ClaimKind;
  children: ReactNode;
}

export function ClaimMark({ kind, children }: ClaimMarkProps) {
  return (
    <span className={`claim claim--${kind}`} data-kind={kind}>
      {children}
    </span>
  );
}
