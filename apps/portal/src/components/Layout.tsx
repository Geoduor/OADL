import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../app/auth.js';
import { useUnreadCount } from '../app/useUnreadCount.js';
import { badgeText } from '../lib/notifications.js';

export function Layout() {
  const { user, signOut } = useAuth();
  const unread = useUnreadCount(user !== null);
  return (
    <div className="shell">
      <header className="topbar">
        <strong className="brand">OADL</strong>
        {user?.role === 'MANAGER' && (
          <nav className="nav" aria-label="Main">
            <NavLink to="/manager/orders">Orders</NavLink>
            <NavLink to="/manager/agents">Agents</NavLink>
            <NavLink to="/manager/stock">Stock</NavLink>
            <NavLink to="/manager/payments">Payments</NavLink>
          </nav>
        )}
        {user?.role === 'AGENT' && (
          <nav className="nav" aria-label="Main">
            <NavLink to="/agent" end>
              Orders
            </NavLink>
            <NavLink to="/agent/stock">My stock</NavLink>
          </nav>
        )}
        <span className="spacer" />
        <NavLink
          to="/notifications"
          className="bell"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
          }
        >
          Alerts
          {unread > 0 && <span className="count">{badgeText(unread)}</span>}
        </NavLink>
        <span className="who">{user?.name}</span>
        <button type="button" className="link" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
