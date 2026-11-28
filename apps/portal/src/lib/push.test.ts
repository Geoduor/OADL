import { describe, expect, it } from 'vitest';
import { pushSupport, subscriptionBody, urlBase64ToBytes } from './push.js';

const desktop = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  isApple: false,
  isStandalone: false,
};

describe('pushSupport', () => {
  it('is ok where everything exists', () => {
    expect(pushSupport(desktop)).toBe('ok');
  });

  it('is unsupported when a needed feature is missing', () => {
    expect(pushSupport({ ...desktop, hasPushManager: false })).toBe(
      'unsupported',
    );
  });

  it('asks an iPhone user to add the app to the Home Screen first', () => {
    expect(pushSupport({ ...desktop, isApple: true })).toBe('needs-install');
    expect(pushSupport({ ...desktop, isApple: true, isStandalone: true })).toBe(
      'ok',
    );
  });
});

describe('urlBase64ToBytes', () => {
  it('decodes URL-safe base64 with or without padding', () => {
    // "hello?>" encodes to aGVsbG8_Pg in URL-safe base64 (no padding).
    const bytes = urlBase64ToBytes('aGVsbG8_Pg');
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111, 63, 62]);
  });
});

describe('subscriptionBody', () => {
  it('keeps only what the API needs', () => {
    expect(
      subscriptionBody({
        endpoint: 'https://push.example.com/x',
        expirationTime: null,
        keys: { p256dh: 'a', auth: 'b' },
      }),
    ).toEqual({
      endpoint: 'https://push.example.com/x',
      keys: { p256dh: 'a', auth: 'b' },
    });
  });

  it('refuses a subscription with missing keys', () => {
    expect(
      subscriptionBody({ endpoint: 'https://push.example.com/x' }),
    ).toBeNull();
  });
});
