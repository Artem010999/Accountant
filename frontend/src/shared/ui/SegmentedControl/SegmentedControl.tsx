import './SegmentedControl.css';

// Переключатель в форме пилюли: вкладки «Регистрация / Вход» и «Первая оплата / Продление».
export interface SegmentedOption {
  id: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  /** tabs — role tablist/tab; buttons — role group с обычными кнопками. */
  mode?: 'tabs' | 'buttons';
  /** block — на всю ширину, пункты делят её поровну. */
  block?: boolean;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  mode = 'buttons',
  block = false,
}: SegmentedControlProps) {
  const isTabs = mode === 'tabs';
  const classes = ['segmented', block ? 'segmented--block' : ''].filter(Boolean).join(' ');

  return (
    <div className={classes} role={isTabs ? 'tablist' : 'group'} aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.id === value;
        const itemClass = ['segmented__item', active ? 'segmented__item--active' : ''].filter(Boolean).join(' ');
        return (
          <button
            key={option.id}
            type="button"
            className={itemClass}
            role={isTabs ? 'tab' : undefined}
            aria-selected={isTabs ? active : undefined}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
