import type { InputHTMLAttributes } from 'react';
import './TextField.css';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** focus — показать состояние «В фокусе» из дизайн-системы (персиковое кольцо) без реального фокуса. */
  state?: 'default' | 'focus';
}

export function TextField({ label, state = 'default', className, ...rest }: TextFieldProps) {
  const inputClass = [
    'field__input',
    state === 'focus' ? 'field__input--focus' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className="field">
      <span>{label}</span>
      <input type="text" className={inputClass} {...rest} />
    </label>
  );
}
