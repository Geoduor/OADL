import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../lib/api.js';
import { formatKes, formatNairobi } from '../../lib/format.js';
import {
  ORDER_STATUSES,
  type ManagerOrderList,
  type OrderStatus,
} from '../../lib/types.js';

// Read-only list for now. Open, assign and the other actions come next.
export function OrdersPage() {
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [data, setData] = useState<ManagerOrderList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    const query = new URLSearchParams({ limit: '50' });
    if (status) query.set('status', status);
    api<ManagerOrderList>(`/manager/orders?${query.toString()}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : 'Could not load orders',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <section>
      <div className="row">
        <h1>Orders</h1>
        <Link to="/manager/orders/new" className="secondary linklike">
          New order
        </Link>
        <label className="inline">
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as OrderStatus | '')
            }
          >
            <option value="">All</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="status">Loading…</p>}
      {data && data.orders.length === 0 && (
        <p className="muted">No orders yet.</p>
      )}
      {data && data.orders.length > 0 && (
        <>
          <p className="muted">
            Showing {data.orders.length} of {data.total}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Customer</th>
                  <th>County</th>
                  <th>Total</th>
                  <th>Agent</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/manager/orders/${order.id}`}>
                        {order.orderNo}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                      {order.paymentMismatch && (
                        <span
                          className="badge warn"
                          title="Amount collected differs from the total"
                        >
                          Amount differs
                        </span>
                      )}
                    </td>
                    <td>
                      {order.customerName}
                      <br />
                      <span className="muted">{order.customerPhone}</span>
                    </td>
                    <td>{order.county.name}</td>
                    <td>{formatKes(order.totalKes)}</td>
                    <td>{order.assignedAgent?.displayName ?? '—'}</td>
                    <td>{formatNairobi(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
