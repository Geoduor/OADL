import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../lib/api.js';
import { agentActionsFor, type AgentAction } from '../../lib/agent-actions.js';
import { formatKes } from '../../lib/format.js';
import type { AgentOrder } from '../../lib/types.js';

type Method = 'CASH' | 'MPESA';

// Agent: one order, and the moves an agent may make. Delivering records how
// much the customer paid and by which method (D34); a different amount is
// allowed and the manager sees it flagged.
export function AgentOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<AgentOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<AgentAction | null>(null);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<Method>('CASH');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<AgentOrder>(`/agent/orders/${id}`)
      .then(setOrder)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Could not load'),
      );
  }, [id]);

  function choose(next: AgentAction) {
    setAction(next);
    setError(null);
    setDate('');
    setReason('');
    setMethod('CASH');
    setAmount(order ? String(order.totalKes) : '');
  }

  async function submit() {
    if (!action || !order) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        to: action.to,
        ...(action.needs === 'date' ? { scheduledDate: date } : {}),
        ...(action.needs === 'payment'
          ? { paymentMethod: method, amountKes: Number(amount) }
          : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      };
      const result = await api<
        AgentOrder | { id: string; status: 'DELIVERED' }
      >(`/agent/orders/${id}/status`, { method: 'POST', body });
      if (action.to === 'DELIVERED') {
        // A delivered order leaves the agent's list at once.
        void navigate('/agent', {
          replace: true,
          state: { notice: `${order.orderNo} marked as delivered.` },
        });
        return;
      }
      setOrder(result as AgentOrder);
      setAction(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Something went wrong',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!order) {
    return error ? (
      <>
        <p className="error" role="alert">
          {error}
        </p>
        <Link to="/agent">← My orders</Link>
      </>
    ) : (
      <p className="status">Loading…</p>
    );
  }

  const amountNumber = Number(amount);
  const ready =
    !!action &&
    (action.needs !== 'date' || date.length > 0) &&
    (action.needs !== 'payment' ||
      (Number.isInteger(amountNumber) && amountNumber > 0));

  return (
    <section>
      <p>
        <Link to="/agent">← My orders</Link>
      </p>
      <div className="row">
        <h1>{order.orderNo}</h1>
        <span className={`badge ${order.status.toLowerCase()}`}>
          {order.status}
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="item">
        <strong>{order.customerName}</strong>
        <br />
        <a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a>
        <br />
        {order.location}, {order.county.name}
        <ul className="plain">
          {order.items.map((item, index) => (
            <li key={index}>
              {item.quantity} × {item.product.name}
            </li>
          ))}
        </ul>
        <strong>Collect {formatKes(order.totalKes)}</strong>
        {order.scheduledDate && (
          <div className="muted">Scheduled {order.scheduledDate}</div>
        )}
      </div>

      <h2>What happened?</h2>
      {agentActionsFor(order.status).length === 0 ? (
        <p className="muted">Nothing to do on this order.</p>
      ) : (
        <div className="actions wrap">
          {agentActionsFor(order.status).map((option) => (
            <button
              key={option.key}
              type="button"
              className={option.to === 'DELIVERED' ? 'primary' : 'secondary'}
              onClick={() => choose(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {action && (
        <form
          className="item editor"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <strong>{action.label}</strong>
          {action.needs === 'payment' && (
            <>
              <fieldset className="field">
                <legend>Paid by</legend>
                <label className="check">
                  <input
                    type="radio"
                    name="method"
                    checked={method === 'CASH'}
                    onChange={() => setMethod('CASH')}
                  />
                  Cash
                </label>
                <label className="check">
                  <input
                    type="radio"
                    name="method"
                    checked={method === 'MPESA'}
                    onChange={() => setMethod('MPESA')}
                  />
                  M-Pesa
                </label>
              </fieldset>
              <label className="field">
                Amount received (KES)
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              {amountNumber !== order.totalKes && amount !== '' && (
                <p className="muted">
                  This is different from {formatKes(order.totalKes)}. The
                  manager will see it flagged.
                </p>
              )}
            </>
          )}
          {action.needs === 'date' && (
            <label className="field">
              New date
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          )}
          {(action.to === 'UNRESPONSIVE' || action.to === 'RESCHEDULED') && (
            <label className="field">
              Note (optional)
              <input
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
          <div className="actions">
            <button type="submit" className="primary" disabled={busy || !ready}>
              {busy ? 'Saving…' : 'Confirm'}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => setAction(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
