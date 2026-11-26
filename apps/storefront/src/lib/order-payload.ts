// Pure helpers that build the order request. No browser storage is used
// (US-9: Facebook's in-app browser), the idempotency key lives in memory.

// UUID v4. Uses crypto.randomUUID where it exists (secure pages), otherwise
// builds one from crypto.getRandomValues.
export function newIdempotencyKey(): string {
  // randomUUID is missing on pages that are not served over HTTPS.
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UTM_FIELDS = {
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_content: 'utmContent',
} as const;

// The API accepts 1 to 200 characters for each tracking value (US-8).
export function utmFrom(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const result: Record<string, string> = {};
  for (const [param, field] of Object.entries(UTM_FIELDS)) {
    const value = params.get(param)?.trim().slice(0, 200);
    if (value) result[field] = value;
  }
  return result;
}

export interface OrderInput {
  idempotencyKey: string;
  turnstileToken: string;
  customerName: string;
  customerPhone: string;
  countyId: string;
  location: string;
  productId: string;
  quantity: number;
  landingSlug: string;
  search: string;
}

// Prices are never sent: the server prices every order from its database.
export function buildOrderPayload(input: OrderInput): Record<string, unknown> {
  return {
    idempotencyKey: input.idempotencyKey,
    turnstileToken: input.turnstileToken,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    countyId: input.countyId,
    location: input.location.trim(),
    items: [{ productId: input.productId, quantity: input.quantity }],
    landingSlug: input.landingSlug.slice(0, 200),
    ...utmFrom(input.search),
  };
}

// https://wa.me/<number>?text=<message>, as in docs/INTEGRATIONS.md.
// Returns null unless the number is digits only with a plausible length.
export function whatsappLink(
  number: string | undefined,
  message: string,
): string | null {
  const digits = (number ?? '').trim();
  if (!/^\d{8,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
