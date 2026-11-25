import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../lib/api.js';
import { formatKes } from '../../lib/format.js';
import { bundleTotal } from '../../lib/order-total.js';
import type { County, ManagerOrderDetail, Product } from '../../lib/types.js';

// Manager: enter an order for a customer who reached him another way
// (phone, WhatsApp, in person). It starts CONFIRMED (D36). Prices come from
// the bundles on the server; the manager may set a different total, with a
// reason that is kept in the order history.
export function CreateOrderPage() {
  const navigate = useNavigate();
  // One key per form, so a double click cannot create two orders.
  const idempotencyKey = useRef(crypto.randomUUID());
  const [counties, setCounties] = useState<County[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [countyId, setCountyId] = useState('');
  const [location, setLocation] = useState('');
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [changeTotal, setChangeTotal] = useState(false);
  const [totalKes, setTotalKes] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api<County[]>('/counties'), api<Product[]>('/products')])
      .then(([c, p]) => {
        setCounties(c);
        setProducts(p);
      })
      .catch((caught: unknown) =>
        setLoadError(
          caught instanceof Error ? caught.message : 'Could not load the form',
        ),
      );
  }, []);

  const items = Object.entries(chosen)
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));
  const computed = bundleTotal(products, chosen);
  const newTotal = Number(totalKes);
  const totalDiffers =
    changeTotal && Number.isInteger(newTotal) && newTotal !== computed;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await api<ManagerOrderDetail>('/manager/orders', {
        method: 'POST',
        body: {
          idempotencyKey: idempotencyKey.current,
          customerName,
          customerPhone,
          countyId,
          location,
          items,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(changeTotal ? { totalKes: newTotal } : {}),
          ...(totalDiffers && reason.trim() ? { reason: reason.trim() } : {}),
        },
      });
      void navigate(`/manager/orders/${created.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Something went wrong',
      );
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <p className="error" role="alert">
        {loadError}
      </p>
    );
  }

  return (
    <section>
      <p>
        <Link to="/manager/orders">← All orders</Link>
      </p>
      <h1>New order</h1>
      <p className="muted">
        For a customer who contacted you directly. The order starts as
        Confirmed.
      </p>
      <form className="item editor" onSubmit={(event) => void submit(event)}>
        <label className="field">
          Customer name
          <input
            required
            minLength={2}
            maxLength={100}
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
          />
        </label>
        <label className="field">
          Phone number
          <input
            required
            type="tel"
            inputMode="tel"
            placeholder="07XX XXX XXX"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
          />
        </label>
        <label className="field">
          County
          <select
            required
            value={countyId}
            onChange={(event) => setCountyId(event.target.value)}
          >
            <option value="">Choose a county</option>
            {counties.map((county) => (
              <option key={county.id} value={county.id}>
                {county.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Delivery location (town, estate, landmark)
          <input
            required
            minLength={3}
            maxLength={300}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>

        {products.map((product) => (
          <label key={product.id} className="field">
            {product.name}
            <select
              value={chosen[product.id] ?? 0}
              onChange={(event) =>
                setChosen({
                  ...chosen,
                  [product.id]: Number(event.target.value),
                })
              }
            >
              <option value={0}>None</option>
              {product.prices.map((price) => (
                <option key={price.quantity} value={price.quantity}>
                  {price.quantity} — {formatKes(price.priceKes)}
                </option>
              ))}
            </select>
          </label>
        ))}

        <label className="field">
          Note (optional)
          <input
            maxLength={1000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <p>
          <strong>Bundle total {formatKes(computed)}</strong>
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={changeTotal}
            onChange={(event) => setChangeTotal(event.target.checked)}
          />
          Set a different total
        </label>
        {changeTotal && (
          <>
            <label className="field">
              Total (KES)
              <input
                required
                type="number"
                min={1}
                step={1}
                value={totalKes}
                onChange={(event) => setTotalKes(event.target.value)}
              />
            </label>
            {totalDiffers && (
              <label className="field">
                Reason for the different total (required)
                <input
                  required
                  maxLength={300}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
            )}
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button
            type="submit"
            className="primary"
            disabled={busy || items.length === 0}
          >
            {busy ? 'Saving…' : 'Create order'}
          </button>
          <Link to="/manager/orders">Cancel</Link>
        </div>
      </form>
    </section>
  );
}
