import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../lib/api.js';
import { formatKes } from '../../lib/format.js';
import type { AgentOverview, StockRow } from '../../lib/types.js';

// Agent: today at a glance. Cash collected is what the agent recorded at
// delivery (D38), not earnings: there is no fee rule yet (Q34).
export function AgentHomePage() {
  const [overview, setOverview] = useState<AgentOverview | null>(null);
  const [stock, setStock] = useState<StockRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<AgentOverview>('/agent/overview'),
      api<StockRow[]>('/agent/stock'),
    ])
      .then(([o, s]) => {
        setOverview(o);
        setStock(s);
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Could not load'),
      );
  }, []);

  return (
    <section>
      <h1>Today</h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!overview && !error && <p className="status">Loading…</p>}
      {overview && (
        <>
          <div className="grid2">
            <div className="item">
              <h2>Completed today</h2>
              <p className="big">
                {overview.completedToday.done} / {overview.completedToday.of}
              </p>
            </div>
            <div className="item">
              <h2>Cash collected today</h2>
              <p className="big">{formatKes(overview.collectedTodayKes)}</p>
              <p className="muted">
                {overview.deliveredToday} delivered · as you recorded it
              </p>
            </div>
          </div>
          <div className="item">
            <h2>
              Open orders: {overview.open.total}{' '}
              <Link to="/agent/orders">See all</Link>
            </h2>
            <ul className="plain">
              <li>Assigned: {overview.open.assigned}</li>
              <li>Dispatched: {overview.open.dispatched}</li>
              <li>Rescheduled: {overview.open.rescheduled}</li>
              <li>Customer unresponsive: {overview.open.unresponsive}</li>
            </ul>
          </div>
        </>
      )}
      {stock && (
        <div className="item">
          <h2>
            My stock <Link to="/agent/stock">Details</Link>
          </h2>
          {stock.length === 0 && (
            <p className="muted">No stock has been issued to you yet.</p>
          )}
          <ul className="plain">
            {stock.map((row) => (
              <li key={row.productId}>
                {row.productName}: {row.available} free ({row.onHand} on hand)
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
