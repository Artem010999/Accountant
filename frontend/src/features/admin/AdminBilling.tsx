import { useEffect, useState } from 'react';
import {
  demoAdminBillingService,
  type AdminBillingService,
  type AdminBillingSummary,
  type AdminPayment,
  type AdminPlan,
  type PaymentStatus,
} from '../../shared/data/adminBilling';
import { formatRub, type PlanFeatures } from '../../shared/data/plans';
import './AdminBilling.css';

// Экран «Платежи и тарифы» (user-flows F15) по design/project/AdminBilling.dc.html.
// Данные — через сервис AdminBillingService (в приложении демо-реализация, в тестах подмена).

type Tab = 'pay' | 'plans';
type StatusFilter = 'all' | PaymentStatus;
type NumericPlanKey = 'price_rub' | 'duration_days' | 'file_uploads_limit' | 'renewal_discount_percent';

export interface AdminBillingProps {
  service?: AdminBillingService;
}

const STATUS_LABEL: Record<PaymentStatus, string> = {
  succeeded: 'Оплачен',
  pending: 'Ожидает',
  failed: 'Ошибка',
  refunded: 'Возврат',
};

// Фильтр по статусу — элемент, которого нет в эталоне (см. отчёт G4): подписи взяты из эталонных чипов.
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'succeeded', label: STATUS_LABEL.succeeded },
  { id: 'pending', label: STATUS_LABEL.pending },
  { id: 'failed', label: STATUS_LABEL.failed },
  { id: 'refunded', label: STATUS_LABEL.refunded },
];

const PLAN_NUMBER_FIELDS: { key: NumericPlanKey; label: string; max?: number }[] = [
  { key: 'price_rub', label: 'Цена, ₽' },
  { key: 'duration_days', label: 'Дней' },
  { key: 'file_uploads_limit', label: 'Лимит файлов' },
  { key: 'renewal_discount_percent', label: 'Скидка продления, %', max: 100 },
];

const PLAN_FEATURE_FIELDS: { key: keyof PlanFeatures; label: string }[] = [
  { key: 'ai_parsing', label: 'Разбор документов ИИ' },
  { key: 'novelty_check', label: 'Проверка новизны' },
  { key: 'consultant', label: 'Консультант' },
];

// Плейсхолдер сводки, пока значения нет (решение владельца: без демо-значений в сводке).
const PLACEHOLDER = '—';

const SAVED_NOTE = 'Сохранено. Уже оплаченные подписки не меняются.';
const DEFAULT_NOTE = 'Новые цены применятся к следующим оплатам.';

/** Дата ISO (YYYY-MM-DD) → «08.11.2026», как в эталоне. */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

/** Значение поля ввода: пустое или некорректное значение даёт 0. */
function toNumber(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function tabClass(active: boolean): string {
  return active ? 'admin-billing__tab admin-billing__tab--active' : 'admin-billing__tab';
}

function filterClass(active: boolean): string {
  return active ? 'admin-billing__filter admin-billing__filter--active' : 'admin-billing__filter';
}

export function AdminBilling({ service = demoAdminBillingService }: AdminBillingProps = {}) {
  const [tab, setTab] = useState<Tab>('pay');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [summary, setSummary] = useState<AdminBillingSummary | null>(null);
  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [plans, setPlans] = useState<AdminPlan[] | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([service.getSummary(), service.listPayments(), service.listPlans()]).then(
      ([nextSummary, nextPayments, nextPlans]) => {
        if (!alive) return;
        setSummary(nextSummary);
        setPayments(nextPayments);
        setPlans(nextPlans);
      },
    );
    return () => {
      alive = false;
    };
  }, [service]);

  function changePlan(id: AdminPlan['id'], change: (plan: AdminPlan) => AdminPlan) {
    setPlans((prev) => (prev ? prev.map((plan) => (plan.id === id ? change(plan) : plan)) : prev));
    setSaved(false);
  }

  function setPlanNumber(id: AdminPlan['id'], key: NumericPlanKey, value: number) {
    changePlan(id, (plan) => ({ ...plan, [key]: value }) as AdminPlan);
  }

  function setPlanFeature(id: AdminPlan['id'], key: keyof PlanFeatures, value: boolean) {
    changePlan(id, (plan) => ({ ...plan, features: { ...plan.features, [key]: value } }));
  }

  async function savePlans() {
    if (!plans) return;
    await service.savePlans(plans);
    setSaved(true);
  }

  const visiblePayments = payments?.filter((p) => statusFilter === 'all' || p.status === statusFilter) ?? [];

  return (
    <>
      <div className="admin-billing__header">
        <h1 className="admin-billing__title">Платежи и тарифы</h1>
        <div role="tablist" aria-label="Раздел" className="admin-billing__tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pay'}
            className={tabClass(tab === 'pay')}
            onClick={() => setTab('pay')}
          >
            Платежи
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'plans'}
            className={tabClass(tab === 'plans')}
            onClick={() => setTab('plans')}
          >
            Тарифы
          </button>
        </div>
      </div>

      {tab === 'pay' && (
        <div className="admin-billing__stack">
          <div className="admin-billing__stats">
            <div className="admin-billing__stat">
              <span className="admin-billing__stat-label">Выручка за месяц</span>
              <span className="admin-billing__stat-value">
                {summary?.revenueMonthRub != null ? formatRub(summary.revenueMonthRub) : PLACEHOLDER}
              </span>
            </div>
            <div className="admin-billing__stat">
              <span className="admin-billing__stat-label">Активных подписок</span>
              <span className="admin-billing__stat-value">{summary?.activeSubscriptions ?? PLACEHOLDER}</span>
            </div>
            <div className="admin-billing__stat">
              <span className="admin-billing__stat-label">Ожидают подтверждения</span>
              <span className="admin-billing__stat-value">{summary?.pendingCount ?? PLACEHOLDER}</span>
            </div>
          </div>

          <div role="group" aria-label="Фильтр по статусу" className="admin-billing__filters">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={statusFilter === f.id}
                className={filterClass(statusFilter === f.id)}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="admin-billing__table-wrap">
            <table className="admin-billing__table">
              <thead>
                <tr>
                  <th scope="col">Дата</th>
                  <th scope="col">Пользователь</th>
                  <th scope="col">Тариф</th>
                  <th scope="col">Сумма</th>
                  <th scope="col">Скидка</th>
                  <th scope="col">Провайдер</th>
                  <th scope="col">ID платежа</th>
                  <th scope="col">Статус</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((p) => (
                  <tr key={p.id}>
                    <td className="admin-billing__cell admin-billing__cell--muted">{formatDate(p.date)}</td>
                    <td className="admin-billing__cell">{p.user}</td>
                    <td className="admin-billing__cell">{p.planName}</td>
                    <td className="admin-billing__cell admin-billing__cell--strong">{formatRub(p.amountRub)}</td>
                    <td className="admin-billing__cell">
                      {p.discountPercent === null ? '—' : `${p.discountPercent}%`}
                    </td>
                    <td className="admin-billing__cell">{p.provider}</td>
                    <td className="admin-billing__cell admin-billing__cell--id">{p.providerPaymentId ?? '—'}</td>
                    <td className="admin-billing__cell">
                      <span className={`admin-billing__chip admin-billing__chip--${p.status}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="admin-billing__note">Повторное уведомление ЮKassa с тем же ID не создаёт второй платёж.</p>
        </div>
      )}

      {tab === 'plans' && plans && (
        <div className="admin-billing__stack">
          <div className="admin-billing__plans">
            {plans.map((plan) => (
              <div key={plan.id} className="admin-billing__plan">
                <div className="admin-billing__plan-head">
                  <h2 className="admin-billing__plan-name">{plan.name}</h2>
                  <code className="admin-billing__plan-code">{plan.id}</code>
                </div>

                <div className="admin-billing__fields">
                  {PLAN_NUMBER_FIELDS.map((field) => (
                    <label key={field.key} className="admin-billing__label">
                      {field.label}
                      <input
                        type="number"
                        className="admin-billing__input"
                        min={0}
                        max={field.max}
                        value={plan[field.key]}
                        onChange={(e) => setPlanNumber(plan.id, field.key, toNumber(e.target.value))}
                      />
                    </label>
                  ))}
                </div>

                <fieldset className="admin-billing__features">
                  <legend className="admin-billing__legend">Функции</legend>
                  {PLAN_FEATURE_FIELDS.map((field) => (
                    <label key={field.key} className="admin-billing__check">
                      <input
                        type="checkbox"
                        className="admin-billing__checkbox"
                        checked={plan.features[field.key]}
                        onChange={(e) => setPlanFeature(plan.id, field.key, e.target.checked)}
                      />
                      {field.label}
                    </label>
                  ))}
                </fieldset>
              </div>
            ))}
          </div>

          <div className="admin-billing__save">
            <button type="button" className="admin-billing__save-btn" onClick={() => void savePlans()}>
              Сохранить тарифы
            </button>
            <span role="status" className="admin-billing__save-note">
              {saved ? SAVED_NOTE : DEFAULT_NOTE}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
