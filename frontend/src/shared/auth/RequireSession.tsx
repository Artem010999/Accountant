import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchMe } from '../api/auth';

// Защита маршрутов кабинета: без входа — на /auth. Работает только в живом режиме (см. AppRoutes).
export function RequireSession({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking');

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((user) => {
      if (!cancelled) setState(user ? 'in' : 'out');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking') {
    return (
      <main className="ob-page">
        <p className="ob-lead">Проверяем вход…</p>
      </main>
    );
  }
  if (state === 'out') {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
