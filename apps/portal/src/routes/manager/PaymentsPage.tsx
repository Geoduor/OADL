import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { formatKes, nairobiDate } from '../../lib/format.js';
import type { PaymentsSummary } from '../../lib/types.js';

// Manager: what each agent has recorded as collected (D34, D38). It is a
// record of what agents said they received, not a balance owed: handing the
// money over to the manager is not recorded yet.
export function PaymentsPage() {
  const [from, setFrom] = useState(() => nairobiDate());
  const [to, setTo] = useState(() => nairobiDate());
  const [data, setData] = useState<PaymentsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    api<PaymentsSummary>(`/manager/payments/summary?${query.toString()}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Could not load payments',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  function preset(daysBack: number | 'all') {
    if (daysBack === 'all') {
      setFrom('');
      setTo('');
    } else {
      setFrom(nairobiDate(new Date(), daysBack));
      setTo(nairobiDate());
    }
  }

  return (
    <section>
      <h1>Payments collected</h1>
      <p className="muted">
        What each agent recorded as received on delivery. Money handed over to
        you is not tracked yet, so this is not a balance owed.
      </p>

      <div className="actions wrap">
        <button type="button" className="secondary" onClick={() => preset(0)}>
          Today
        </button>
        <button type="button" className="secondary" onClick={() => preset(6)}>
          Last 7 days
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => preset('all')}
        >
          All time
        </button>
      </div>
      <div className="actions wrap">
        <label className="inline">
          From
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="inline">
          To
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="status">Loading…</p>}
      {data && data.agents.length === 0 && (
        <p className="muted">No payments recorded for these dates.</p>
      )}
      {data && data.agents.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Cash</th>
                <th>M-Pesa</th>
                <th>Total</th>
                <th>Payments</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((row) => (
                <tr key={row.agentUserId}>
                  <td>{row.agentName}</td>
                  <td>{formatKes(row.cashKes)}</td>
                  <td>{formatKes(row.mpesaKes)}</td>
                  <td>{formatKes(row.totalKes)}</td>
                  <td>{row.payments}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>All agents</strong>
                </td>
                <td>
                  <strong>{formatKes(data.totals.cashKes)}</strong>
                </td>
                <td>
                  <strong>{formatKes(data.totals.mpesaKes)}</strong>
                </td>
                <td>
                  <strong>{formatKes(data.totals.totalKes)}</strong>
                </td>
                <td>
                  <strong>{data.totals.payments}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
