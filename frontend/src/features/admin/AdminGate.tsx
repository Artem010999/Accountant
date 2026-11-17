import { useEffect, useState, type ReactNode } from 'react';
import { fetchMe, type CurrentUser } from '../../shared/api/auth';
import { CodeLogin } from '../site/CodeLogin';
import '../onboarding/common.css';

// Вход в админку: сначала basic auth на уровне сервера (Caddy), затем код из письма для аккаунта с role = 'admin'.
// Ссылки на админку из публичного интерфейса не ведут. Роль выдаётся только вручную в БД.
export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'admin' | 'login'>('checking');

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((user) => {
      if (!cancelled) setState(user?.role === 'admin' ? 'admin' : 'login');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking') {
    return (
      <main className="ob-page">
        <p className="ob-lead">Проверяем доступ…</p>
      </main>
    );
  }
  if (state === 'login') {
    return (
      <main className="ob-page">
        <h1 className="ob-title">Вход администратора</h1>
        <CodeLogin purpose="admin" submitLabel="Войти в админку" onSuccess={(user: CurrentUser) => setState(user.role === 'admin' ? 'admin' : 'login')} />
      </main>
    );
  }
  return <>{children}</>;
}
