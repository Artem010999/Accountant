import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Logo } from '../ui/Logo/Logo';
import { NavIcon } from '../ui/NavIcon/NavIcon';
import type { SideNavItem } from '../ui/SideNav/SideNav';
import '../ui/SideNav/SideNav.css';
import './CabinetLayout.css';

// Пункты кабинета из user-flows §1 и Passport.dc.html.
export const CABINET_NAV: SideNavItem[] = [
  { to: '/passport', label: 'Паспорт', icon: 'passport' },
  { to: '/gaps', label: 'Пробелы', icon: 'gaps' },
  { to: '/result', label: 'Итог', icon: 'result' },
  { to: '/files', label: 'Материалы', icon: 'files' },
  { to: '/billing', label: 'Тариф', icon: 'billing' },
  { to: '/profile', label: 'Профиль', icon: 'profile' },
];

// Меню собрано здесь, а не через SideNav из shared/ui: тому не нужен счётчик, а общие компоненты не меняем.
// Счётчик показываем у «Пробелов» (иконка gaps), как в Passport.dc.html и Gaps.dc.html.

export interface CabinetProject {
  name: string;
  program: string;
}

export interface CabinetPlan {
  name: string;
  validUntil: string;
  files: string;
  /** Заполнение полоски, проценты 0–100. */
  fillPercent: number;
}

export interface CabinetUser {
  initials: string;
  name: string;
}

/** Настройки шелла, которые зависят от экрана. */
export interface CabinetShellSettings {
  /** Счётчик у пункта «Пробелы». null — счётчик не показывается. */
  gapsCount: number | null;
  /** CSS padding области экрана. */
  mainPadding: string;
  /** CSS gap между блоками экрана. */
  mainGap: string;
  /** Показывать блок тарифа внизу меню. В эталоне Files.dc.html его нет. */
  showPlan: boolean;
}

export interface CabinetLayoutProps {
  project?: Partial<CabinetProject>;
  plan?: Partial<CabinetPlan>;
  user?: Partial<CabinetUser>;
  /** Счётчик у «Пробелов» по умолчанию (до переопределения экраном через useCabinetShell). */
  gapsCount?: number | null;
}

// Значения по умолчанию — данные-пример из Passport.dc.html.
// TODO(G3): брать проект, тариф и пользователя из Supabase вместо значений по умолчанию.
const DEFAULT_PROJECT: CabinetProject = { name: 'Monetrix', program: 'Студенческий стартап' };
const DEFAULT_PLAN: CabinetPlan = {
  name: 'Профессиональный',
  validUntil: 'до 1 декабря 2026',
  files: 'Файлы: 3 из 10',
  fillPercent: 30,
};
const DEFAULT_USER: CabinetUser = { initials: 'ИИ', name: 'Иван Иванов' };

// Шелл по умолчанию — как в Passport.dc.html (отступы совпадают с токенами CabinetLayout.css).
const SHELL_DEFAULTS: CabinetShellSettings = {
  gapsCount: 1,
  mainPadding: '28px 32px 56px',
  mainGap: '20px',
  showPlan: true,
};

// Значения по маршруту из эталонов Gaps.dc.html и Result.dc.html.
// Отступы 36px 48px 64px и зазор 28px вне токенов (значения из inline-стилей эталонов).
// На /result счётчика нет (в Result.dc.html пункт «Пробелы» без счётчика).
const ROUTE_SHELL: Record<string, Partial<CabinetShellSettings>> = {
  '/gaps': { mainPadding: '36px 48px 64px', mainGap: '28px' },
  '/result': { gapsCount: null, mainPadding: '36px 48px 64px', mainGap: '28px' },
  '/files': { showPlan: false },
  '/billing': { showPlan: false },
  '/profile': { showPlan: false },
};

type ShellSetter = (patch: Partial<CabinetShellSettings>) => void;
const CabinetShellContext = createContext<ShellSetter | null>(null);

/**
 * Экран переопределяет настройки шелла (счётчик «Пробелов», отступы main) на время своей жизни.
 * При уходе с экрана переопределения сбрасываются, и действуют значения маршрута и по умолчанию.
 */
export function useCabinetShell(settings: Partial<CabinetShellSettings>): void {
  const setShell = useContext(CabinetShellContext);
  const key = JSON.stringify(settings);
  useEffect(() => {
    if (!setShell) return undefined;
    setShell(JSON.parse(key) as Partial<CabinetShellSettings>);
    return () => setShell({});
  }, [setShell, key]);
}

export function CabinetLayout({
  project,
  plan,
  user,
  gapsCount,
}: CabinetLayoutProps = {}) {
  const { pathname } = useLocation();
  const [overrides, setOverrides] = useState<Partial<CabinetShellSettings>>({});
  const setShell = useCallback<ShellSetter>((patch) => setOverrides(patch), []);
  const contextValue = useMemo(() => setShell, [setShell]);

  const p = { ...DEFAULT_PROJECT, ...project };
  const pl = { ...DEFAULT_PLAN, ...plan };
  const u = { ...DEFAULT_USER, ...user };
  const shell: CabinetShellSettings = {
    ...SHELL_DEFAULTS,
    ...(gapsCount !== undefined ? { gapsCount } : {}),
    ...ROUTE_SHELL[pathname],
    ...overrides,
  };
  const mainStyle = {
    '--cabinet-main-padding': shell.mainPadding,
    '--cabinet-main-gap': shell.mainGap,
  } as CSSProperties;

  return (
    <CabinetShellContext.Provider value={contextValue}>
      <div className="cabinet">
        <aside className="cabinet__aside">
          <Logo variant="cabinet" to="/" ariaLabel="Буха — на главную" />

          <div className="cabinet__card">
            <span className="cabinet__caption">Проект</span>
            <span className="cabinet__project-name">{p.name}</span>
            <span className="cabinet__meta">{p.program}</span>
          </div>

          <nav aria-label="Разделы кабинета" className="sidenav sidenav--light">
            {CABINET_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className="sidenav__link">
                <NavIcon name={item.icon} />
                <span className="sidenav__label">{item.label}</span>
                {item.icon === 'gaps' && shell.gapsCount !== null && (
                  <span className="cabinet__badge" aria-hidden="true">{shell.gapsCount}</span>
                )}
              </NavLink>
            ))}
          </nav>

          {shell.showPlan && (
          <div className="cabinet__card cabinet__plan">
            <span className="cabinet__plan-name">{pl.name}</span>
            <span className="cabinet__meta">{pl.validUntil}</span>
            <span className="cabinet__meta">{pl.files}</span>
            <span className="cabinet__bar" aria-hidden="true">
              <span className="cabinet__bar-fill" style={{ width: `${pl.fillPercent}%` }} />
            </span>
          </div>
          )}

          <div className="cabinet__user">
            <span className="cabinet__avatar" aria-hidden="true">{u.initials}</span>
            <span className="cabinet__user-name">{u.name}</span>
            <Link to="/" className="cabinet__logout">Выйти</Link>
          </div>
        </aside>

        <main className="cabinet__main" style={mainStyle}>
          <Outlet />
        </main>
      </div>
    </CabinetShellContext.Provider>
  );
}
