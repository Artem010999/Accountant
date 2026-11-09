import { Navigate, Route, Routes } from 'react-router-dom';
import { PassportPage } from '../features/passport/PassportPage';
import { PricingPage } from '../features/billing/PricingPage';
import { AdminPage } from '../features/admin/AdminPage';

// Маршруты MVP. Auth-гейт (Supabase session) добавить сюда же, обёрткой над Routes.
export function App() {
  return (
    <Routes>
      <Route path="/" element={<PassportPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
