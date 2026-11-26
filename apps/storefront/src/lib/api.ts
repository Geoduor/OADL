import type { County, PlacedOrder, Product } from './types';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// The API base URL. In production it must be set, so a missing value fails
// loudly instead of quietly calling localhost.
export function apiBase(): string {
  const value = process.env['NEXT_PUBLIC_API_URL'];
  if (value) {
    return value.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }
  return 'http://localhost:3000';
}

function messageFrom(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && typeof message[0] === 'string') {
      return message[0];
    }
  }
  return fallback;
}

// Server-side reads. Cached briefly so a traffic spike from an ad does not
// hit the API for every visitor.
async function read<T>(path: string, revalidate: number): Promise<T | null> {
  const response = await fetch(`${apiBase()}${path}`, {
    next: { revalidate },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new ApiError(response.status, `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function getProducts(): Promise<Product[]> {
  return (await read<Product[]>('/products', 60)) ?? [];
}

export function getProduct(slug: string): Promise<Product | null> {
  return read<Product>(`/products/${encodeURIComponent(slug)}`, 60);
}

export async function getCounties(): Promise<County[]> {
  return (await read<County[]>('/counties', 3600)) ?? [];
}

// Browser call. No cookies are sent: the shop has no sign-in.
export async function submitOrder(
  payload: Record<string, unknown>,
): Promise<PlacedOrder> {
  const response = await fetch(`${apiBase()}/orders`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      messageFrom(body, `Request failed (${response.status})`),
    );
  }
  return body as PlacedOrder;
}
