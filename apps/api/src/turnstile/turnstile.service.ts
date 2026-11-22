import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

// Server-side token check. Docs (read 2026-11-22):
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
// The widget alone does not protect a form: tokens can be forged, so every
// order is verified here with the secret key (CAPTCHA_SECRET, never in the
// front end). Tokens are single use, so the caller must not verify twice.
const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5000;

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  // Fails closed: if the check cannot run (no secret, network error,
  // Cloudflare error) the order is refused with 503.
  // TODO(confirm): whether the client prefers to accept orders when
  // Cloudflare is unreachable (fail open). Default is fail closed.
  async verify(token: string, remoteIp?: string): Promise<void> {
    const secret = process.env['CAPTCHA_SECRET'];
    if (!secret) {
      this.logger.error('CAPTCHA_SECRET is not set');
      throw new ServiceUnavailableException('Bot check is unavailable');
    }

    let body: unknown;
    try {
      const response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, response: token, remoteip: remoteIp }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`siteverify returned HTTP ${response.status}`);
      }
      body = await response.json();
    } catch (error) {
      // Never log the token, the secret or any customer data.
      this.logger.error(
        `Turnstile verification could not run: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new ServiceUnavailableException('Bot check is unavailable');
    }

    const result = typeof body === 'object' && body !== null ? body : {};
    if (!('success' in result) || result.success !== true) {
      const codes =
        'error-codes' in result && Array.isArray(result['error-codes'])
          ? result['error-codes'].join(',')
          : 'none';
      this.logger.warn(`Turnstile check failed (codes: ${codes})`);
      throw new BadRequestException('Bot check failed. Please try again.');
    }
  }
}
