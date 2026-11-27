import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api } from '../../lib/api.js';
import { formatKes } from '../../lib/format.js';
import {
  countByStatus,
  filterAgentOrders,
  NO_FILTERS,
  type OrderFilters,
  type StatusFilter,
} from '../../lib/order-filters.js';
import type { AgentOrder } from '../../lib/types.js';

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'RESCHEDULED', label: 'Rescheduled' },
  { value: 'UNRESPONSIVE', label: 'Unresponsive' },
];

// Agent: my open orders. The server returns only orders assigned to me.
export function AgentOrdersPage() {
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [orders, setOrders] = useState<AgentOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilters>(NO_FILTERS);

  useEffect(() => {
    api<AgentOrder[]>('/agent/orders')
      .then(setOrders)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Could not load'),
      );
  }, []);

  const counts = countByStatus(orders ?? []);
  const shown = orders ? filterAgentOrders(orders, filters) : [];

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
      {orders && orders.length > 0 && (
        <div className="filters">
          <div className="chips" role="group" aria-label="Status">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                className={
                  filters.status === chip.value ? 'chip active' : 'chip'
                }
                aria-pressed={filters.status === chip.value}
                onClick={() => setFilters({ ...filters, status: chip.value })}
              >
                {chip.label} ({counts[chip.value] ?? 0})
              </button>
            ))}
          </div>
          <label className="field">
            Scheduled date
            <input
              type="date"
              value={filters.scheduledDate}
              onChange={(event) =>
                setFilters({ ...filters, scheduledDate: event.target.value })
              }
            />
          </label>
        </div>
      )}
      {orders?.length === 0 && (
        <p className="muted">No open orders right now.</p>
      )}
      {orders && orders.length > 0 && shown.length === 0 && (
        <p className="muted">
          No orders match these filters.{' '}
          <button
            type="button"
            className="link"
            onClick={() => setFilters(NO_FILTERS)}
          >
            Clear filters
          </button>
        </p>
      )}
      <ul className="list">
        {shown.map((order) => (
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
