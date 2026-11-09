// Админка: настройки guard_threshold_*, пользователи, бан. Роль проверяется на бэкенде (RLS / service_role).
// Смена role только через SQL Editor или service_role — из UI роль не меняется.
export function AdminPage() {
  return (
    <main>
      <h1>Администрирование</h1>
      <p>TODO: app_settings (пороги Стража), управление пользователями</p>
    </main>
  );
}
