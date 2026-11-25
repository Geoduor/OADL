import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api } from '../../lib/api.js';
import { formatKes } from '../../lib/format.js';
import type { AgentOrder } from '../../lib/types.js';

// Agent: my open orders. The server returns only orders assigned to me.
export function AgentOrdersPage() {
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [orders, setOrders] = useState<AgentOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AgentOrder[]>('/agent/orders')
      .then(setOrders)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Could not load'),
      );
  }, []);

  return (
    <section>
      <h1>My orders</h1>
      {notice && <p className="notice">{notice}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!orders && !error && <p className="status">Loading…</p>}
      {orders?.length === 0 && (
        <p className="muted">No open orders right now.</p>
      )}
      <ul className="list">
        {orders?.map((order) => (
          <li key={order.id}>
            <Link to={`/agent/orders/${order.id}`} className="item block">
              <div className="row">
                <strong>{order.customerName}</strong>
                <span className={`badge ${order.status.toLowerCase()}`}>
                  {order.status}
                </span>
              </div>
              <div className="muted">
                {order.location}, {order.county.name}
              </div>
              <div>
                {order.items
                  .map((item) => `${item.quantity} × ${item.product.name}`)
                  .join(', ')}{' '}
                · {formatKes(order.totalKes)}
              </div>
              {order.scheduledDate && (
                <div className="muted">Scheduled {order.scheduledDate}</div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
