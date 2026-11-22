import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TurnstileService } from './turnstile.service.js';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('TurnstileService', () => {
  const service = new TurnstileService();
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    process.env['CAPTCHA_SECRET'] = 'test-secret';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['CAPTCHA_SECRET'];
  });

  it('accepts a token Cloudflare approves and sends secret, token and IP', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await expect(service.verify('tok', '10.0.0.1')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      secret: 'test-secret',
      response: 'tok',
      remoteip: '10.0.0.1',
    });
  });

  it('rejects a token Cloudflare refuses with 400', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
    );
    await expect(service.verify('tok')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('fails closed with 503 when Cloudflare cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(service.verify('tok')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails closed with 503 on a non-200 answer', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    await expect(service.verify('tok')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails closed with 503 when CAPTCHA_SECRET is missing', async () => {
    delete process.env['CAPTCHA_SECRET'];
    await expect(service.verify('tok')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
