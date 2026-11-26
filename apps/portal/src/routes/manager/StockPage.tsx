import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api.js';
import { formatNairobi } from '../../lib/format.js';
import {
  STOCK_ACTIONS,
  movementLabel,
  stockBody,
  type StockAction,
} from '../../lib/stock-actions.js';
import type {
  Product,
  StockMovementRow,
  StockOverviewAgent,
} from '../../lib/types.js';

function messageOf(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'Something went wrong';
}

// Manager: what each agent holds, recording stock moves (D35) and the
// history of every move. The server enforces the rules.
export function StockPage() {
  const [overview, setOverview] = useState<StockOverviewAgent[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [moves, setMoves] = useState<{
    total: number;
    movements: StockMovementRow[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<StockAction | null>(null);
  const [agentUserId, setAgentUserId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, p, m] = await Promise.all([
        api<StockOverviewAgent[]>('/manager/stock'),
        api<Product[]>('/products'),
        api<{ total: number; movements: StockMovementRow[] }>(
          '/manager/stock/movements?limit=50',
        ),
      ]);
      setOverview(o);
      setProducts(p);
      setMoves(m);
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function choose(next: StockAction) {
    setAction(next);
    setAgentUserId('');
    setProductId(products.length === 1 ? (products[0]?.id ?? '') : '');
    setQuantity('');
    setNote('');
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!action) return;
    const body = stockBody(action, { agentUserId, productId, quantity, note });
    if (!body) {
      setError(
        action.signed
          ? 'Enter a whole number (not zero) and a reason.'
          : 'Enter a whole number of units, more than zero.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(action.path, { method: 'POST', body });
      setAction(null);
      await load();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  // Giving stock is only for active agents; returns and corrections also
  // apply to a disabled agent who still holds stock.
  const choosable = (overview ?? []).filter(
    (agent) => action?.key !== 'issue' || agent.active,
  );

  return (
    <section>
      <h1>Stock</h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {(!overview || !moves) && !error && <p className="status">Loading…</p>}

      <div className="actions wrap">
        {STOCK_ACTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className="secondary"
            onClick={() => choose(option)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {action && (
        <form className="item editor" onSubmit={(event) => void submit(event)}>
          <strong>{action.label}</strong>
          <label className="field">
            Agent
            <select
              required
              value={agentUserId}
              onChange={(event) => setAgentUserId(event.target.value)}
            >
              <option value="">Choose an agent</option>
              {choosable.map((agent) => (
                <option key={agent.agentUserId} value={agent.agentUserId}>
                  {agent.agentName}
                  {agent.active ? '' : ' (disabled)'}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Product
            <select
              required
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Choose a product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {action.signed
              ? 'Change in units (use a minus for a loss, e.g. -2)'
              : 'Units'}
            <input
              required
              type="number"
              inputMode="numeric"
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label className="field">
            {action.noteRequired ? 'Reason (required)' : 'Note (optional)'}
            <input
              required={action.noteRequired}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div className="actions">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
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

      {overview && (
        <>
          <h2>Who holds what</h2>
          {overview.length === 0 && <p className="muted">No agents yet.</p>}
          <ul className="list">
            {overview.map((agent) => (
              <li key={agent.agentUserId} className="item">
                <strong>{agent.agentName}</strong>{' '}
                {!agent.active && (
                  <span className="badge cancelled">Disabled</span>
                )}
                {agent.products.length === 0 ? (
                  <div className="muted">No stock.</div>
                ) : (
                  <ul className="plain">
                    {agent.products.map((row) => (
                      <li key={row.productId}>
                        {row.productName}: {row.onHand} on hand, {row.reserved}{' '}
                        reserved, {row.available} free
                        {row.needsAttention && (
                          <span className="badge warn">Below zero</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {moves && (
        <>
          <h2>History</h2>
          <p className="muted">
            Latest {moves.movements.length} of {moves.total} moves
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Agent</th>
                  <th>Product</th>
                  <th>Move</th>
                  <th>Units</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {moves.movements.map((move, index) => (
                  <tr key={index}>
                    <td>{formatNairobi(move.createdAt)}</td>
                    <td>{move.agent.displayName}</td>
                    <td>{move.product.name}</td>
                    <td>{movementLabel(move.type)}</td>
                    <td>
                      {move.quantity > 0 ? '+' : ''}
                      {move.quantity}
                    </td>
                    <td>
                      {[
                        move.order?.orderNo,
                        move.note,
                        move.createdBy ? `by ${move.createdBy.name}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </td>
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
