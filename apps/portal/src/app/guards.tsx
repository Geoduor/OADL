import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './auth.js';
import type { Role } from '../lib/types.js';

// The server enforces every permission. These guards only decide which
// screen to show, so a signed-out visitor sees the sign-in page and an agent
// does not land on a manager screen that would answer 403.
export function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) {
    return <p className="status">Loading…</p>;
  }
  if (user === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth();
  if (!user) {
    return null;
  }
  if (user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) {
    return null;
  }
  return (
    <Navigate
      to={user.role === 'MANAGER' ? '/manager/orders' : '/agent'}
      replace
    />
  );
}
