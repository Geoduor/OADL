import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import type { StockRow } from '../../lib/types.js';

// Agent: the stock I carry. Issued by the manager (D35); deliveries reduce it.
export function AgentStockPage() {
  const [rows, setRows] = useState<StockRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<StockRow[]>('/agent/stock')
      .then(setRows)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Could not load'),
      );
  }, []);

  return (
    <section>
      <h1>My stock</h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!rows && !error && <p className="status">Loading…</p>}
      {rows?.length === 0 && (
        <p className="muted">No stock has been issued to you yet.</p>
      )}
      <ul className="list">
        {rows?.map((row) => (
          <li key={row.productId} className="item">
            <div className="row">
              <strong>{row.productName}</strong>
              <span>{row.onHand} on hand</span>
            </div>
            <div className="muted">
              {row.reserved} reserved for open orders · {row.available} free
            </div>
            {row.needsAttention && (
              <p className="error">
                Your count is below zero. Tell the manager so it can be fixed.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
