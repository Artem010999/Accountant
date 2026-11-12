import { useEffect, useId, useRef } from 'react';
import { PLANS, formatRub } from '../../shared/data/plans';
import './PlansModal.css';

// Модальное окно «Тарифы»: три тарифа из админки (название, цена, описание).
// Вместо окна оплаты, пока нет платёжного шлюза (FLAGS.HIDE_PAYMENT_GATEWAY). Без сторонних библиотек.

export interface PlansModalProps {
  onClose: () => void;
}

export function PlansModal({ onClose }: PlansModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="plans-modal__overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="plans-modal__dialog"
      >
        <div className="plans-modal__head">
          <h2 id={titleId} className="plans-modal__title">
            Тарифы
          </h2>
          <button type="button" aria-label="Закрыть" className="plans-modal__close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17171C" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <ul className="plans-modal__list">
          {PLANS.map((plan) => (
            <li key={plan.id} className="plans-modal__item">
              <h3 className="plans-modal__name">{plan.name}</h3>
              <p className="plans-modal__desc">{plan.description}</p>
              <p className="plans-modal__price">
                {formatRub(plan.price_rub)} <span className="plans-modal__price-unit">за {plan.duration_days} дней</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
