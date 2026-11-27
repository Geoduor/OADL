import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { formatKes, formatNairobi } from '../../lib/format.js';
import type { AgentHistory, HistoryRange } from '../../lib/types.js';

const RANGES: { value: HistoryRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'all', label: 'All' },
];

// Agent: orders I delivered. No customer details: a delivered order leaves
// the agent's view (D27).
export function AgentHistoryPage() {
  const [range, setRange] = useState<HistoryRange>('week');
  const [data, setData] = useState<AgentHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    api<AgentHistory>(`/agent/history?range=${range}`)
      .then((result) => {
        if (current) {
          setData(result);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (current) {
          setError(caught instanceof Error ? caught.message : 'Could not load');
        }
      });
    return () => {
      current = false;
    };
  }, [range]);

  return (
    <section>
      <h1>History</h1>
      <div className="chips" role="group" aria-label="Period">
        {RANGES.map((entry) => (
          <button
            key={entry.value}
            type="button"
            className={range === entry.value ? 'chip active' : 'chip'}
            aria-pressed={range === entry.value}
            onClick={() => setRange(entry.value)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="status">Loading…</p>}
      {data && (
        <>
          <p>
            <strong>{data.count}</strong> delivered · cash collected{' '}
            <strong>{formatKes(data.collectedKes)}</strong>
          </p>
          {data.count > data.deliveries.length && (
            <p className="muted">
              Showing the latest {data.deliveries.length}. Totals include all.
            </p>
          )}
          {data.deliveries.length === 0 && (
            <p className="muted">No deliveries in this period.</p>
          )}
          <ul className="list">
            {data.deliveries.map((entry) => (
              <li key={entry.id} className="item">
                <div className="row">
                  <strong>{entry.orderNo}</strong>
                  <span>{formatKes(entry.amountKes)}</span>
                </div>
                <div className="muted">
                  {formatNairobi(entry.deliveredAt)} · {entry.county} ·{' '}
                  {entry.method === 'CASH' ? 'Cash' : 'M-Pesa'}
                </div>
                <div>
                  {entry.items
                    .map((item) => `${item.quantity} × ${item.productName}`)
                    .join(', ')}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
