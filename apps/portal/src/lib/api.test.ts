import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api.js';

function respond(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('sends the session cookie and parses JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/auth/me')).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/me');
    expect(init.credentials).toBe('include');
    expect(init.method).toBe('GET');
  });

  it('sends a JSON body with the right header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, {}));
    vi.stubGlobal('fetch', fetchMock);
    await api('/auth/login', { method: 'POST', body: { phone: '1' } });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe('{"phone":"1"}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('returns undefined for 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(204)));
    await expect(
      api('/auth/logout', { method: 'POST' }),
    ).resolves.toBeUndefined();
  });

  it('throws ApiError with the server message and status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respond(401, { message: 'Nope' })),
    );
    const error = await api('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: 'Nope' });
  });

  it('uses the first message when the API sends a list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respond(400, { message: ['First', 'Second'] })),
    );
    await expect(api('/x')).rejects.toMatchObject({ message: 'First' });
  });

  it('falls back to a generic message for a non-JSON error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>', { status: 502 })),
    );
    await expect(api('/x')).rejects.toMatchObject({
      status: 502,
      message: 'Request failed (502)',
    });
  });
});
