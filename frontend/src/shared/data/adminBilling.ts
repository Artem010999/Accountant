import { PLANS, type Plan } from './plans';

// Слой данных админки «Платежи и тарифы» (user-flows F15). Бэкенда для админки пока нет (G5).
// Экран получает сервис пропом: в приложении подставляется демо-реализация ниже, в тестах — подмена.
// Демо-значения взяты из design/project/AdminBilling.dc.html. Плейсхолдеры сводки эталона ([СУММА], [N]) в демо
// не заполняются: демо-сервис отдаёт null, экран показывает «—» (решение владельца, см. отчёт G4).

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export type PaymentProvider = 'ЮKassa' | 'Вручную';

export interface AdminPayment {
  id: string;
  /** Дата в формате ISO: YYYY-MM-DD. */
  date: string;
  user: string;
  planName: string;
  amountRub: number;
  /** Скидка за продление в процентах; null — скидки нет (в таблице «—»). */
  discountPercent: number | null;
  provider: PaymentProvider;
  /** ID платежа в ЮKassa (сокращённый, как в эталоне); null — платёж создан вручную (в таблице «—»). */
  providerPaymentId: string | null;
  status: PaymentStatus;
}

/** Тариф для админки: поля Plan без временного описания (его в эталоне нет). */
export type AdminPlan = Omit<Plan, 'description'>;

/** Сводка для трёх плейсхолдеров экрана. null — значения нет, экран показывает «—». */
export interface AdminBillingSummary {
  revenueMonthRub: number | null;
  activeSubscriptions: number | null;
  pendingCount: number | null;
}

export interface AdminBillingService {
  getSummary(): Promise<AdminBillingSummary>;
  listPayments(): Promise<AdminPayment[]>;
  listPlans(): Promise<AdminPlan[]>;
  savePlans(plans: AdminPlan[]): Promise<void>;
}

const DEMO_PAYMENTS: AdminPayment[] = [
  {
    id: 'pay-1',
    date: '2026-11-08',
    user: 'Мария Ли',
    planName: 'Премиум',
    amountRub: 4990,
    discountPercent: null,
    provider: 'ЮKassa',
    providerPaymentId: '2f9a…c41e',
    status: 'pending',
  },
  {
    id: 'pay-2',
    date: '2026-11-07',
    user: 'Анна Смирнова',
    planName: 'Профессиональный',
    amountRub: 990,
    discountPercent: null,
    provider: 'ЮKassa',
    providerPaymentId: '2f97…0b3d',
    status: 'failed',
  },
  {
    id: 'pay-3',
    date: '2026-11-05',
    user: 'Мария Ли',
    planName: 'Премиум',
    amountRub: 0,
    discountPercent: null,
    provider: 'Вручную',
    providerPaymentId: null,
    status: 'succeeded',
  },
  {
    id: 'pay-4',
    date: '2026-11-01',
    user: 'Иван Иванов',
    planName: 'Профессиональный',
    amountRub: 841,
    discountPercent: 15,
    provider: 'ЮKassa',
    providerPaymentId: '2f8e…7a10',
    status: 'succeeded',
  },
  {
    id: 'pay-5',
    date: '2026-10-28',
    user: 'Олег Носов',
    planName: 'Профессиональный',
    amountRub: 990,
    discountPercent: null,
    provider: 'ЮKassa',
    providerPaymentId: '2f71…d2a8',
    status: 'refunded',
  },
];

function clonePlan(plan: AdminPlan): AdminPlan {
  return { ...plan, features: { ...plan.features } };
}

function planFromCatalog(plan: Plan): AdminPlan {
  return {
    id: plan.id,
    name: plan.name,
    price_rub: plan.price_rub,
    duration_days: plan.duration_days,
    file_uploads_limit: plan.file_uploads_limit,
    renewal_discount_percent: plan.renewal_discount_percent,
    features: { ...plan.features },
  };
}

/** Демо-реализация сервиса: данные в памяти, сохранение живёт до перезагрузки страницы. */
export function createDemoAdminBillingService(): AdminBillingService {
  let plans: AdminPlan[] = PLANS.map(planFromCatalog);

  return {
    async getSummary() {
      // Сводка без бэкенда (G5): ни выручка, ни счётчики не вычисляются и не задаются константами.
      return { revenueMonthRub: null, activeSubscriptions: null, pendingCount: null };
    },
    async listPayments() {
      return DEMO_PAYMENTS.map((p) => ({ ...p }));
    },
    async listPlans() {
      return plans.map(clonePlan);
    },
    async savePlans(next) {
      plans = next.map(clonePlan);
    },
  };
}

export const demoAdminBillingService: AdminBillingService = createDemoAdminBillingService();
