import { Link, Outlet } from 'react-router-dom';
import { Logo } from '../ui/Logo/Logo';
import { SideNav, type SideNavItem } from '../ui/SideNav/SideNav';
import './AdminLayout.css';

// Пункты админки из user-flows §1 и AdminUsers.dc.html.
export const ADMIN_NAV: SideNavItem[] = [
  { to: '/admin-panel/users', label: 'Пользователи', icon: 'users' },
  { to: '/admin-panel/billing', label: 'Платежи и тарифы', icon: 'payments' },
  { to: '/admin-panel/guard', label: 'Страж', icon: 'guard' },
  { to: '/admin-panel/kb', label: 'База знаний', icon: 'kb' },
];

export function AdminLayout() {
  return (
    <div className="admin">
      <aside className="admin__aside">
        <Logo variant="admin" to="/" ariaLabel="Буха — на главную" />

        <SideNav items={ADMIN_NAV} variant="dark" ariaLabel="Разделы админки" />

        <div className="admin__footer">
          <span className="admin__role">Админ</span>
          <Link to="/auth" className="admin__logout">Выйти</Link>
        </div>
      </aside>

      <main className="admin__main">
        <Outlet />
      </main>
    </div>
  );
}
