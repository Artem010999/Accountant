import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../../shared/ui/Logo/Logo';
import './OnboardingHeader.css';

export type OnboardingStep = 1 | 2 | 3;

const STEP_LABELS = ['Профиль', 'О проекте', 'Сборка паспорта'] as const;

export interface OnboardingHeaderProps {
  /** Текущий шаг: шаги с меньшим номером завершены. */
  current: OnboardingStep;
  /** Если задан, подпись завершённого шага 1 ведёт на этот маршрут (как на Brief в эталоне). */
  profileLink?: string;
  /** Правая часть шапки: e-mail на Onboarding, прототипный переключатель на Brief и Generating. */
  trailing?: ReactNode;
}

// Шапка онбординга из эталонов Onboarding / Brief / Generating: логотип, три шага, правая часть.
export function OnboardingHeader({ current, profileLink, trailing }: OnboardingHeaderProps) {
  return (
    <header className="obh">
      <div className="obh__inner">
        <Link to="/" className="obh__brand" aria-label="Буха Паспорт — на главную">
          <BrandMark size={34} />
          <span className="obh__word">Буха</span>
        </Link>
        <ol aria-label="Шаги" className="obh__steps">
          {STEP_LABELS.map((label, index) => {
            const n = (index + 1) as OnboardingStep;
            const state = n < current ? 'done' : n === current ? 'current' : 'pending';
            const isLast = index === STEP_LABELS.length - 1;
            const linked = state === 'done' && index === 0 && profileLink ? profileLink : undefined;
            return (
              <StepItems key={label} state={state} n={n} label={label} linkTo={linked} connectorDone={n < current} showConnector={!isLast} />
            );
          })}
        </ol>
        {trailing}
      </div>
    </header>
  );
}

interface StepItemsProps {
  state: 'done' | 'current' | 'pending';
  n: OnboardingStep;
  label: string;
  linkTo?: string;
  connectorDone: boolean;
  showConnector: boolean;
}

// Один шаг (кружок и подпись) и соединитель после него. Соединитель оранжевый, если шаг завершён.
function StepItems({ state, n, label, linkTo, connectorDone, showConnector }: StepItemsProps) {
  const dot = (
    <span className={`obh__dot obh__dot--${state}`}>
      {state === 'done' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12l5 5 9-10" />
        </svg>
      ) : (
        n
      )}
    </span>
  );
  return (
    <>
      <li className={`obh__step obh__step--${state}`}>
        {dot}
        {linkTo ? (
          <Link to={linkTo} className="obh__link">
            {label}
          </Link>
        ) : (
          label
        )}
      </li>
      {showConnector && <li aria-hidden="true" className={`obh__line${connectorDone ? ' obh__line--done' : ''}`} />}
    </>
  );
}
