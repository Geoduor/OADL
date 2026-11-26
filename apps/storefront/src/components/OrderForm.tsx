'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, submitOrder } from '../lib/api';
import { copy } from '../lib/copy';
import { formatKes } from '../lib/format';
import { buildOrderPayload, newIdempotencyKey } from '../lib/order-payload';
import type { County, Product } from '../lib/types';
import { Turnstile } from './Turnstile';

// Used only when no site key is set in local development, with Cloudflare's
// documented test secret on the API. Never accepted in production: the
// button stays disabled there without a real site key.
const DEV_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

function friendly(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return copy.tooManyAttempts;
    if (error.status >= 500) return copy.tryAgainSoon;
    return error.message;
  }
  return copy.noConnection;
}

export function OrderForm({
  product,
  counties,
}: {
  product: Product;
  counties: County[];
}) {
  const router = useRouter();
  const siteKey = process.env['NEXT_PUBLIC_CAPTCHA_SITE_KEY'] ?? '';
  const isProduction = process.env.NODE_ENV === 'production';
  const botCheckAvailable = Boolean(siteKey) || !isProduction;

  // One key per form: a double tap, or a retry after a lost response, returns
  // the same order instead of creating another.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [quantity, setQuantity] = useState(product.prices[0]?.quantity ?? 0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countyId, setCountyId] = useState('');
  const [location, setLocation] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = product.prices.find((price) => price.quantity === quantity);
  const effectiveToken = siteKey ? token : DEV_TOKEN;
  const ready =
    botCheckAvailable && Boolean(effectiveToken) && Boolean(selected);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !effectiveToken || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const order = await submitOrder(
        buildOrderPayload({
          idempotencyKey,
          turnstileToken: effectiveToken,
          customerName: name,
          customerPhone: phone,
          countyId,
          location,
          productId: product.id,
          quantity: selected.quantity,
          landingSlug: product.slug,
          search: window.location.search,
        }),
      );
      router.push(`/order/${encodeURIComponent(order.orderNo)}`);
    } catch (caught) {
      setError(friendly(caught));
      // The token is single use, so ask for a new one.
      setResetCount((count) => count + 1);
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={(event) => void submit(event)}>
      <h2>{copy.chooseBundle}</h2>
      <div className="bundles" role="radiogroup" aria-label={copy.chooseBundle}>
        {product.prices.map((price) => (
          <label
            key={price.quantity}
            className={price.quantity === quantity ? 'bundle on' : 'bundle'}
          >
            <input
              type="radio"
              name="bundle"
              checked={price.quantity === quantity}
              onChange={() => setQuantity(price.quantity)}
            />
            <span>
              {price.quantity} {price.quantity === 1 ? copy.unit : copy.units}
            </span>
            <strong>{formatKes(price.priceKes)}</strong>
          </label>
        ))}
      </div>

      <h2>{copy.yourDetails}</h2>
      <label className="field">
        {copy.name}
        <input
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="field">
        {copy.phone}
        <input
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="07XX XXX XXX"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <small>{copy.phoneHint}</small>
      </label>
      <label className="field">
        {copy.county}
        <select
          required
          value={countyId}
          onChange={(event) => setCountyId(event.target.value)}
        >
          <option value="">{copy.chooseCounty}</option>
          {counties.map((county) => (
            <option key={county.id} value={county.id}>
              {county.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {copy.location}
        <input
          required
          minLength={3}
          maxLength={300}
          autoComplete="street-address"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
        <small>{copy.locationHint}</small>
      </label>

      {siteKey && (
        <Turnstile
          siteKey={siteKey}
          onToken={setToken}
          resetCount={resetCount}
        />
      )}

      <p className="total">
        {copy.total}:{' '}
        <strong>{selected ? formatKes(selected.priceKes) : '—'}</strong>
      </p>
      <p className="note">{copy.payOnDelivery}</p>

      {!botCheckAvailable && <p className="error">{copy.botCheckMissing}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primary" disabled={busy || !ready}>
        {busy ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
