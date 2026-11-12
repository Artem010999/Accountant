import './SiteArt.css';

// Совёнок без плашки (hero лендинга) или на белой плашке (блоки призыва и вход).
// Иллюстрация из inline-SVG эталонов; цвета — классы из SiteArt.css (токены).
export interface MascotProps {
  size: number;
  variant?: 'bare' | 'tile';
}

export function Mascot({ size, variant = 'bare' }: MascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={`mascot mascot--${variant}`}
    >
      {variant === 'tile' && <rect width="40" height="40" rx="12" className="mascot__tile" />}
      <path d="M7 7 L12 11 M33 7 L28 11" className="mascot__brow" strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <circle cx="13.5" cy="18" r="7" className="mascot__eye" />
      <circle cx="26.5" cy="18" r="7" className="mascot__eye" />
      <circle cx="15" cy="17" r="3" className="mascot__pupil" />
      <circle cx="28" cy="17" r="3" className="mascot__pupil" />
      <path d="M17.5 27 L20 31 L22.5 27 Z" className="mascot__beak" />
    </svg>
  );
}
