import { useCallback, useId, useState } from 'react';
import { useCabinetShell } from '../../shared/layout/CabinetLayout';
import { DEFAULT_PLAN_ID, FLAGS, planFeatures } from '../../shared/config/flags';
import {
  formatRub,
  getPlan,
  planActions,
  pluralDays,
  type PlanCardAction,
  type PlanId,
} from '../../shared/data/plans';
import { PlansModal } from './PlansModal';
import './Billing.css';

// Экран «Тариф и оплата» (F12). Эталон: design/project/Billing.dc.html, логика повторяет его renderVals().
// Данные — демо-значения из эталона; подключение к billing_subscriptions / billing_payments — этап G5.
// Пока нет платёжного шлюза (FLAGS.HIDE_PAYMENT_GATEWAY = TRUE): окно оплаты, баннеры результата,
// строка нового платежа и кнопка оплаты не рендерятся; кнопки открывают окно «Тарифы».
// Кнопки карточек по текущему тарифу — planActions() из shared/data/plans.ts (решение владельца, G3r2).

type PaidPlanId = 'pro' | 'premium';
type PayResult = 'ok' | 'fail' | 'pending';

export interface BillingProps {
  /** Текущий тариф. По умолчанию — DEFAULT_PLAN_ID (премиум, решение владельца). free — подписка закончилась. */
  currentPlan?: PlanId;
}

const BASIC = {
  name: 'Базовый',
  description: 'Паспорт, анкета, стоп-факторы и экспорт. Без загрузки файлов и проверки новизны.',
  price: '0 ₽',
};

// Значения окна оплаты из эталона (переход на тариф и продление). Используются только при FLAGS.HIDE_PAYMENT_GATEWAY = FALSE.
const PAID_PLANS: Record<PaidPlanId, { name: string; base: string; discount: string; price: string }> = {
  pro: { name: 'Профессиональный', base: '990 ₽', discount: '15%', price: '841 ₽' },
  premium: { name: 'Премиум', base: '4 990 ₽', discount: '—', price: '4 990 ₽' },
};

// Демо-значения текущей подписки из эталона. daysLeft — оставшиеся дни (эталон: «осталось 23 дня»).
const SUBSCRIPTION = {
  validUntil: '1 декабря 2026',
  daysLeft: 23,
  filesUsed: 3,
  // Лимит текущего тарифа (Премиум = 50), решение владельца: «3 из 50».
  filesLimit: 50,
};
const PAID_UNTIL = '31 декабря 2026';
const CHECKOUT_EMAIL = 'ivan@university.ru';
// Демо-строки истории платежей из эталона (дата нового платежа — демо, в продукте — дата из billing_payments).
const NEW_PAYMENT_DATE = '8 ноября 2026';
const PREVIOUS_PAYMENT = { date: '1 ноября 2026', plan: 'Профессиональный', sum: '841 ₽', discount: '15%' };

const PRO = getPlan('pro');

const PAY_STATUS: Record<PayResult, { label: string; chip: string }> = {
  ok: { label: 'Оплачен', chip: 'billing__chip--ok' },
  fail: { label: 'Не прошёл', chip: 'billing__chip--fail' },
  pending: { label: 'Ожидает', chip: 'billing__chip--pending' },
};

export function Billing({ currentPlan = DEFAULT_PLAN_ID }: BillingProps = {}) {
  // Отступы main из эталона Billing.dc.html (36px 48px 64px); остальное — значения шелла по умолчанию.
  useCabinetShell({ mainPadding: 'var(--space-36) var(--space-48) var(--space-64)' });

  const titleId = useId();
  const [chosen, setChosen] = useState<PaidPlanId>('pro');
  const [checkout, setCheckout] = useState(false);
  const [result, setResult] = useState<PayResult | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const closePlans = useCallback(() => setPlansOpen(false), []);

  const paymentEnabled = !FLAGS.HIDE_PAYMENT_GATEWAY;
  const checkoutOpen = paymentEnabled && checkout;
  const payResult = paymentEnabled ? result : null;

  const isFree = currentPlan === 'free';
  const currentPlanName = getPlan(currentPlan).name;
  const features = planFeatures(getPlan(currentPlan).features);
  const actions = planActions(currentPlan, SUBSCRIPTION.daysLeft);

  const chosenPlan = PAID_PLANS[chosen];
  const filesPercent = Math.round((SUBSCRIPTION.filesUsed / SUBSCRIPTION.filesLimit) * 100);

  const openCheckout = (plan: PaidPlanId) => {
    setChosen(plan);
    setCheckout(true);
  };

  const pay = (next: PayResult) => {
    setCheckout(false);
    setResult(next);
  };

  // Кнопка карточки: при включённом шлюзе — оплата выбранного тарифа, пока шлюза нет — окно «Тарифы».
  const onCardButton = (plan: PaidPlanId) => (paymentEnabled ? openCheckout(plan) : setPlansOpen(true));

  const renderCardAction = (action: PlanCardAction, plan: PaidPlanId) => {
    if (action.kind === 'note') return <span className="billing__plan-note">{action.text}</span>;
    if (action.kind === 'button') {
      return (
        <button type="button" className="billing__plan-buy" onClick={() => onCardButton(plan)}>
          {action.label}
        </button>
      );
    }
    return null;
  };

  return (
    <div className="billing">
      <div className="billing__head">
        <h1 className="billing__title">Тариф и оплата</h1>
        <button type="button" className="billing__plans-open" onClick={() => setPlansOpen(true)}>
          Тарифы
        </button>
      </div>

      {payResult === 'ok' && (
        <div role="status" className="billing__banner billing__banner--ok">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="billing__banner-icon">
            <path d="M5 12l5 5 9-10" />
          </svg>
          <span className="billing__banner-text">
            <b className="billing__banner-strong">Оплата прошла.</b> {chosenPlan.name} действует до {PAID_UNTIL}.
          </span>
          <button type="button" className="billing__banner-action" onClick={() => setResult(null)}>
            Закрыть
          </button>
        </div>
      )}

      {payResult === 'fail' && (
        <div role="alert" className="billing__banner billing__banner--fail">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className="billing__banner-icon">
            <path d="M7 7l10 10M17 7L7 17" />
          </svg>
          <span className="billing__banner-text">
            <b className="billing__banner-strong">Платёж не прошёл.</b> Деньги не списаны. Попробуйте другую карту или СБП.
          </span>
          <button
            type="button"
            className="billing__banner-action billing__banner-action--retry"
            onClick={() => {
              setResult(null);
              setCheckout(true);
            }}
          >
            Повторить
          </button>
        </div>
      )}

      {payResult === 'pending' && (
        <div role="status" className="billing__banner billing__banner--pending">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="billing__banner-icon">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span className="billing__banner-text">
            <b className="billing__banner-strong">Ждём подтверждение от банка.</b> Обычно это пара минут — доступ откроется сам, страницу можно закрыть.
          </span>
          <button type="button" className="billing__banner-action" onClick={() => setResult(null)}>
            Скрыть
          </button>
        </div>
      )}

      <section className="billing__hero">
        <div className="billing__hero-main">
          <span className="billing__caption">Текущий тариф</span>
          <h2 className="billing__hero-title">{currentPlanName}</h2>
          <span className="billing__hero-sub">
            {isFree
              ? BASIC.description
              : `Действует до ${SUBSCRIPTION.validUntil} · осталось ${SUBSCRIPTION.daysLeft} ${pluralDays(SUBSCRIPTION.daysLeft)}`}
          </span>
        </div>
        {!isFree && (
          <>
            <div className="billing__usage">
              <span className="billing__usage-count">
                Файлы: {SUBSCRIPTION.filesUsed} из {SUBSCRIPTION.filesLimit}
              </span>
              <span className="billing__bar" aria-hidden="true">
                <span className="billing__bar-fill" style={{ width: `${filesPercent}%` }} />
              </span>
              {features.novelty_check && <span className="billing__usage-note">Проверка новизны: включена</span>}
            </div>
            <button
              type="button"
              className="billing__renew"
              onClick={() => (paymentEnabled ? openCheckout('pro') : setPlansOpen(true))}
            >
              Продлить
            </button>
          </>
        )}
      </section>

      <section className="billing__section">
        <h2 className="billing__section-title">Другие тарифы</h2>
        <div className="billing__plans">
          {actions.free.kind !== 'hidden' && (
            <div className="billing__plan">
              <h3 className="billing__plan-name">{BASIC.name}</h3>
              <p className="billing__plan-desc">{BASIC.description}</p>
              <p className="billing__plan-price">{BASIC.price}</p>
              {actions.free.kind === 'note' && <span className="billing__plan-note">{actions.free.text}</span>}
            </div>
          )}
          <div className="billing__plan">
            <h3 className="billing__plan-name">{PRO.name}</h3>
            <p className="billing__plan-desc">{PRO.description}</p>
            <p className="billing__plan-price">
              {formatRub(PRO.price_rub)} <span className="billing__plan-price-unit">за {PRO.duration_days} {pluralDays(PRO.duration_days)}</span>
            </p>
            {renderCardAction(actions.pro, 'pro')}
          </div>
          <div className="billing__plan">
            <h3 className="billing__plan-name">Премиум</h3>
            <p className="billing__plan-desc">До 50 файлов и консультант. Остаток текущего периода [ПРАВИЛО ЗАЧЁТА ОСТАТКА].</p>
            <p className="billing__plan-price">
              4 990 ₽ <span className="billing__plan-price-unit">за 30 дней</span>
            </p>
            {renderCardAction(actions.premium, 'premium')}
          </div>
        </div>
      </section>

      <section className="billing__section">
        <h2 className="billing__section-title">История платежей</h2>
        <div className="billing__table-wrap">
          <table className="billing__table">
            <thead>
              <tr>
                <th scope="col">Дата</th>
                <th scope="col">Тариф</th>
                <th scope="col">Сумма</th>
                <th scope="col">Скидка</th>
                <th scope="col">Статус</th>
                <th scope="col">Чек</th>
              </tr>
            </thead>
            <tbody>
              {payResult && (
                <tr>
                  <td>{NEW_PAYMENT_DATE}</td>
                  <td>{chosenPlan.name}</td>
                  <td>{chosenPlan.price}</td>
                  <td>{chosenPlan.discount}</td>
                  <td>
                    <span className={`billing__chip ${PAY_STATUS[payResult].chip}`}>{PAY_STATUS[payResult].label}</span>
                  </td>
                  <td className="billing__muted">—</td>
                </tr>
              )}
              <tr>
                <td>{PREVIOUS_PAYMENT.date}</td>
                <td>{PREVIOUS_PAYMENT.plan}</td>
                <td>{PREVIOUS_PAYMENT.sum}</td>
                <td>{PREVIOUS_PAYMENT.discount}</td>
                <td>
                  <span className="billing__chip billing__chip--ok">Оплачен</span>
                </td>
                <td>
                  <a href="#">Открыть</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {checkoutOpen && (
        <div className="billing__overlay">
          <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="billing__dialog">
            <div className="billing__dialog-head">
              <h2 id={titleId} className="billing__dialog-title">Оплата тарифа</h2>
              <button type="button" aria-label="Закрыть" className="billing__close" onClick={() => setCheckout(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17171C" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <dl className="billing__summary">
              <dt>Тариф</dt>
              <dd className="billing__summary-strong">{chosenPlan.name}</dd>
              <dt>Период</dt>
              <dd>30 дней</dd>
              <dt>Цена</dt>
              <dd>{chosenPlan.base}</dd>
              <dt>Скидка за продление</dt>
              <dd>{chosenPlan.discount}</dd>
              <dt className="billing__total-label">К оплате</dt>
              <dd className="billing__total-value">{chosenPlan.price}</dd>
            </dl>
            <p className="billing__legal">
              Вы перейдёте на защищённую страницу ЮKassa. Автопродления нет. Чек придёт на {CHECKOUT_EMAIL}.
            </p>
            <button type="button" className="billing__pay" onClick={() => pay('ok')}>
              Перейти к оплате
            </button>
            <div className="billing__proto">
              <span>Прототип — исход оплаты:</span>
              <button type="button" className="billing__proto-btn" onClick={() => pay('fail')}>
                ошибка
              </button>
              <button type="button" className="billing__proto-btn" onClick={() => pay('pending')}>
                ожидание
              </button>
            </div>
          </div>
        </div>
      )}

      {plansOpen && <PlansModal onClose={closePlans} />}
    </div>
  );
}
