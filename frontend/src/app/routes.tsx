import { useEffect, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AdminLayout } from '../shared/layout/AdminLayout';
import { CabinetLayout } from '../shared/layout/CabinetLayout';
import { Main } from '../features/site/Main';
import { Pricing } from '../features/site/Pricing';
import { Auth } from '../features/site/Auth';
import { Onboarding } from '../features/onboarding/Onboarding';
import { Brief } from '../features/onboarding/Brief';
import { Generating } from '../features/onboarding/Generating';
import { Gaps } from '../features/passport/Gaps';
import { Result } from '../features/passport/Result';
import { Passport } from '../features/passport/Passport';
import { Files } from '../features/account/Files';
import { Billing } from '../features/account/Billing';
import { Profile } from '../features/account/Profile';
import { States } from '../features/account/States';
import { AdminUsers } from '../features/admin/AdminUsers';
import { AdminBilling } from '../features/admin/AdminBilling';
import { AdminGuard } from '../features/admin/AdminGuard';
import { AdminKB } from '../features/admin/AdminKB';
import { DesignSystem } from '../features/design-system/DesignSystem';
import { Support } from '../features/support/Support';

// Оболочка маршрута: none — без бокового меню; cabinet — меню кабинета; admin — меню админки.
export type RouteShell = 'none' | 'cabinet' | 'admin';

export interface AppRoute {
  path: string;
  shell: RouteShell;
  element: ReactElement;
  /** Заголовок вкладки: <title> соответствующего эталона из design/project/*.dc.html. */
  title: string;
}

/** Заголовок вкладки по умолчанию (совпадает с <title> в index.html). */
export const DEFAULT_TITLE = 'Буха';

// Карта маршрутов из docs/user-flows.md §1 (+ служебная страница дизайн-системы).
export const APP_ROUTES: AppRoute[] = [
  { path: '/', shell: 'none', element: <Main />, title: 'Буха — лендинг' },
  { path: '/pricing', shell: 'none', element: <Pricing />, title: 'Буха — тарифы' },
  { path: '/auth', shell: 'none', element: <Auth />, title: 'Буха — вход и регистрация' },
  { path: '/onboarding', shell: 'none', element: <Onboarding />, title: 'Буха — профиль основателя' },
  { path: '/brief', shell: 'none', element: <Brief />, title: 'Буха — стартовый бриф' },
  { path: '/generating', shell: 'none', element: <Generating />, title: 'Буха — сборка паспорта' },
  { path: '/gaps', shell: 'cabinet', element: <Gaps />, title: 'Буха — пробелы и новизна' },
  { path: '/result', shell: 'cabinet', element: <Result />, title: 'Буха — итог проверки' },
  { path: '/passport', shell: 'cabinet', element: <Passport />, title: 'Буха — паспорт проекта' },
  { path: '/files', shell: 'cabinet', element: <Files />, title: 'Буха — материалы проекта' },
  { path: '/billing', shell: 'cabinet', element: <Billing />, title: 'Буха — тариф и оплата' },
  { path: '/profile', shell: 'cabinet', element: <Profile />, title: 'Буха — профиль' },
  { path: '/states', shell: 'none', element: <States />, title: 'Буха — блокировки и лимиты' },
  { path: '/support', shell: 'none', element: <Support />, title: 'Буха — поддержка' },
  { path: '/admin/users', shell: 'admin', element: <AdminUsers />, title: 'Буха — админка, пользователи' },
  { path: '/admin/billing', shell: 'admin', element: <AdminBilling />, title: 'Буха — админка, платежи и тарифы' },
  { path: '/admin/guard', shell: 'admin', element: <AdminGuard />, title: 'Буха — админка, Страж' },
  { path: '/admin/kb', shell: 'admin', element: <AdminKB />, title: 'Буха — админка, база знаний' },
  { path: '/design-system', shell: 'none', element: <DesignSystem />, title: 'Буха — дизайн-система' },
];

export function AppRoutes() {
  const byShell = (shell: RouteShell) => APP_ROUTES.filter((r) => r.shell === shell);

  // Заголовок вкладки меняется при переходе между маршрутами.
  const location = useLocation();
  const current = APP_ROUTES.find((r) => r.path === location.pathname);
  useEffect(() => {
    document.title = current?.title ?? DEFAULT_TITLE;
  }, [current]);

  return (
    <Routes>
      {byShell('none').map((r) => (
        <Route key={r.path} path={r.path} element={r.element} />
      ))}
      <Route element={<CabinetLayout />}>
        {byShell('cabinet').map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
      </Route>
      <Route element={<AdminLayout />}>
        {byShell('admin').map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
