import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, ApiError } from '../../lib/api.js';
import { formatKes, formatNairobi } from '../../lib/format.js';
import { orderCopyText } from '../../lib/order-text.js';
import { actionsFor, type ManagerAction } from '../../lib/order-actions.js';
import type {
  AgentView,
  ManagerOrderDetail,
  StockShortfall,
} from '../../lib/types.js';

function messageOf(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'Something went wrong';
}

function shortfallsOf(caught: unknown): StockShortfall[] | null {
  if (!(caught instanceof ApiError) || caught.status !== 409) return null;
  const body = caught.body as { code?: string; shortfalls?: StockShortfall[] };
  return body?.code === 'INSUFFICIENT_STOCK' && body.shortfalls
    ? body.shortfalls
    : null;
}

// Manager: one order in full, and the moves allowed from its status. The
// server decides what is legal; this screen only asks and shows the answer.
export function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<ManagerOrderDetail | null>(null);
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ManagerAction | null>(null);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [agentUserId, setAgentUserId] = useState('');
  const [shortfalls, setShortfalls] = useState<StockShortfall[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, agentList] = await Promise.all([
        api<ManagerOrderDetail>(`/manager/orders/${id}`),
        api<AgentView[]>('/agents'),
      ]);
      setOrder(detail);
      setAgents(agentList);
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function choose(next: ManagerAction) {
    setAction(next);
    setReason('');
    setDate('');
    setAgentUserId('');
    setShortfalls(null);
    setError(null);
  }

  async function submit(overrideStock = false) {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/manager/orders/${id}/status`, {
        method: 'POST',
        body: {
          to: action.to,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(action.needs === 'date' ? { scheduledDate: date } : {}),
          ...(action.needs === 'agent' ? { agentUserId } : {}),
          ...(overrideStock ? { overrideStock: true } : {}),
        },
      });
      setAction(null);
      setShortfalls(null);
      await load();
    } catch (caught) {
      const short = shortfallsOf(caught);
      if (short) {
        setShortfalls(short);
      } else {
        setError(messageOf(caught));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!order) {
    return error ? (
      <p className="error" role="alert">
        {error}
      </p>
    ) : (
      <p className="status">Loading…</p>
    );
  }

  const currentAgentId = order.assignedAgent?.userId;
  const assignable = agents
    .filter((agent) => agent.active && agent.status === 'ACTIVE')
    .filter(
      (agent) =>
        !(action?.excludeCurrentAgent && agent.userId === currentAgentId),
    )
    .map((agent) => ({
      agent,
      covers: agent.counties.some((county) => county.id === order.county.id),
    }))
    // Agents who cover the order's county first.
    .sort((a, b) => Number(b.covers) - Number(a.covers));

  const ready =
    !!action &&
    (action.needs !== 'reason' || reason.trim().length > 0) &&
    (action.needs !== 'date' || date.length > 0) &&
    (action.needs !== 'agent' || agentUserId.length > 0);

  async function copyDetails() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(orderCopyText(order));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Your browser blocked clipboard access.');
    }
  }

  return (
    <section>
      <p>
        <Link to="/manager/orders">← All orders</Link>
      </p>
      <div className="row">
        <h1>{order.orderNo}</h1>
        <span className={`badge ${order.status.toLowerCase()}`}>
          {order.status}
        </span>
        <button type="button" onClick={() => void copyDetails()}>
          {copied ? 'Copied' : 'Copy order details'}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="grid2">
        <div className="item">
          <h2>Customer</h2>
          <p>
            {order.customerName}
            <br />
            <span className="muted">{order.customerPhone}</span>
            <br />
            {order.location}, {order.county.name}
          </p>
          {order.notes && <p className="muted">Note: {order.notes}</p>}
          <p className="muted">
            Placed {formatNairobi(order.createdAt)}
            {order.source === 'MANAGER_CREATED' ? ' · entered by manager' : ''}
          </p>
        </div>
        <div className="item">
          <h2>Order</h2>
          <ul className="plain">
            {order.items.map((item, index) => (
              <li key={index}>
                {item.quantity} × {item.product.name} —{' '}
                {formatKes(item.lineTotalKes)}
              </li>
            ))}
          </ul>
          <p>
            <strong>Total {formatKes(order.totalKes)}</strong>
          </p>
          <p className="muted">
            Agent: {order.assignedAgent?.displayName ?? 'none'}
            {order.scheduledDate ? ` · scheduled ${order.scheduledDate}` : ''}
            {order.attemptCount > 0 ? ` · attempts ${order.attemptCount}` : ''}
          </p>
        </div>
      </div>

      {order.payments.length > 0 && (
        <div className="item">
          <h2>Payment</h2>
          <ul className="plain">
            {order.payments.map((payment, index) => (
              <li key={index}>
                {formatKes(payment.amountKes)} by {payment.method} — collected
                by {payment.agent?.displayName ?? 'unknown'},{' '}
                {formatNairobi(payment.createdAt)}
              </li>
            ))}
          </ul>
          {order.paymentMismatch && (
            <p className="error">
              Amount collected ({formatKes(order.paidKes)}) differs from the
              total ({formatKes(order.totalKes)}).
            </p>
          )}
        </div>
      )}

      <h2>Actions</h2>
      {actionsFor(order.status).length === 0 ? (
        <p className="muted">No further actions for this order.</p>
      ) : (
        <div className="actions wrap">
          {actionsFor(order.status).map((option) => (
            <button
              key={option.key}
              type="button"
              className={option.danger ? 'secondary danger' : 'secondary'}
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
          {action.needs === 'agent' && (
            <label className="field">
              Agent
              <select
                value={agentUserId}
                onChange={(event) => setAgentUserId(event.target.value)}
                required
              >
                <option value="">Choose an agent</option>
                {assignable.map(({ agent, covers }) => (
                  <option key={agent.userId} value={agent.userId}>
                    {agent.displayName}
                    {covers ? ' (covers this county)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {action.needs === 'date' && (
            <label className="field">
              New date
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>
          )}
          {(action.needs === 'reason' || action.needs === 'date') && (
            <label className="field">
              {action.needs === 'reason'
                ? 'Reason (required)'
                : 'Reason (optional)'}
              <input
                type="text"
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required={action.needs === 'reason'}
              />
            </label>
          )}
          {shortfalls && (
            <div className="warn-box" role="alert">
              <strong>This agent does not have enough stock:</strong>
              <ul className="plain">
                {shortfalls.map((short) => (
                  <li key={short.productName}>
                    {short.productName}: needs {short.needed}, has{' '}
                    {short.available}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void submit(true)}
              >
                Assign anyway
              </button>
            </div>
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

      <h2>History</h2>
      <ul className="list">
        {order.history.map((entry, index) => (
          <li key={index} className="item">
            <strong>
              {entry.fromStatus ? `${entry.fromStatus} → ` : ''}
              {entry.toStatus}
            </strong>
            <br />
            <span className="muted">
              {formatNairobi(entry.createdAt)}
              {entry.changedBy ? ` · ${entry.changedBy.name}` : ''}
              {entry.agent ? ` · agent ${entry.agent.displayName}` : ''}
            </span>
            {entry.reason && <div>{entry.reason}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}
