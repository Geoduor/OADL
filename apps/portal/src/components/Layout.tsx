import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../app/auth.js';

export function Layout() {
  const { user, signOut } = useAuth();
  return (
    <div className="shell">
      <header className="topbar">
        <strong className="brand">OADL</strong>
        {user?.role === 'MANAGER' && (
          <nav className="nav" aria-label="Main">
            <NavLink to="/manager/orders">Orders</NavLink>
            <NavLink to="/manager/agents">Agents</NavLink>
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
