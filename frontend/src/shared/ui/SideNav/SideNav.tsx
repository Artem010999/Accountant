import { NavLink } from 'react-router-dom';
import { NavIcon, type NavIconName } from '../NavIcon/NavIcon';
import './SideNav.css';

export interface SideNavItem {
  to: string;
  label: string;
  icon: NavIconName;
}

export interface SideNavProps {
  items: SideNavItem[];
  /** light — меню кабинета (на #FAFAFA); dark — меню админки (на #17171C). */
  variant?: 'light' | 'dark';
  ariaLabel: string;
}

// Активный пункт получает aria-current="page" от NavLink; стили активного — по этому атрибуту.
export function SideNav({ items, variant = 'light', ariaLabel }: SideNavProps) {
  return (
    <nav aria-label={ariaLabel} className={`sidenav sidenav--${variant}`}>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className="sidenav__link">
          <NavIcon name={item.icon} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
