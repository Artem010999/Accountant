import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BrandMark, PillLink } from '../ui';
import './SiteLayout.css';

// Публичная оболочка: шапка «Буха Паспорт», навигация и подвал из design/project/Main.dc.html.
// Pricing в эталоне без подвала — для него withFooter={false}.
export interface SiteLayoutProps {
  children: ReactNode;
  withFooter?: boolean;
}

// Якоря вида /#how из других экранов: после перехода прокручиваем к элементу с этим id.
function useHashScroll() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView?.();
  }, [hash, pathname]);
}

// Логотип «Буха Паспорт» из эталонов: совёнок 40 px, «Буха» 800, «Паспорт» оранжевым. Используется и в шапке, и на входе.
export interface SiteBrandProps {
  className?: string;
}

export function SiteBrand({ className }: SiteBrandProps) {
  const classes = ['site__brand', className ?? ''].filter(Boolean).join(' ');
  return (
    <Link to="/" className={classes} aria-label="Буха Паспорт — на главную">
      <BrandMark size={40} />
      <span className="site__brand-word">Буха</span>
      <span className="site__brand-product">Паспорт</span>
    </Link>
  );
}

export function SiteLayout({ children, withFooter = true }: SiteLayoutProps) {
  useHashScroll();

  return (
    <div className="site">
      <header className="site__header">
        <SiteBrand />

        <nav aria-label="Основная навигация" className="site__nav">
          <Link to="/#how" className="site__nav-link">Как это работает</Link>
          <Link to="/#passport" className="site__nav-link">Паспорт</Link>
          <NavLink
            to="/pricing"
            className={({ isActive }) =>
              isActive ? 'site__nav-link site__nav-link--active' : 'site__nav-link'
            }
          >
            Тарифы
          </NavLink>
          <Link to="/#faq" className="site__nav-link">Вопросы</Link>
        </nav>

        <div className="site__actions">
          <Link to="/auth" className="site__signin">Войти</Link>
          <PillLink to="/auth" variant="brand-outline" size="nav">Собрать паспорт</PillLink>
        </div>
      </header>

      {children}

      {withFooter && (
        <footer className="site__footer">
          <div className="site__footer-inner">
            <span className="site__copy">© 2026 Буха. Независимый сервис, не связан с ФСИ.</span>
            <nav aria-label="Документы" className="site__docs">
              <a href="#" className="site__docs-link">Пользовательское соглашение</a>
              <a href="#" className="site__docs-link">Обработка персональных данных</a>
              <a href="#" className="site__docs-link">Поддержка</a>
            </nav>
          </div>
        </footer>
      )}
    </div>
  );
}
