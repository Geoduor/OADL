import { describe, expect, it } from 'vitest';
import {
  buildOrderPayload,
  newIdempotencyKey,
  utmFrom,
  whatsappLink,
} from './order-payload';

describe('newIdempotencyKey', () => {
  it('makes a UUID, different each time', () => {
    const a = newIdempotencyKey();
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(newIdempotencyKey()).not.toBe(a);
  });
});

describe('utmFrom', () => {
  it('keeps only the four tracking values, trimmed and capped', () => {
    const long = 'x'.repeat(300);
    expect(
      utmFrom(
        `?utm_source=facebook&utm_medium=%20cpc%20&utm_campaign=${long}&other=1`,
      ),
    ).toEqual({
      utmSource: 'facebook',
      utmMedium: 'cpc',
      utmCampaign: 'x'.repeat(200),
    });
  });

  it('ignores empty values', () => {
    expect(utmFrom('?utm_source=&utm_content=%20')).toEqual({});
  });
});

describe('buildOrderPayload', () => {
  const input = {
    idempotencyKey: 'k',
    turnstileToken: 't',
    customerName: '  Jane Doe ',
    customerPhone: ' 0712 345 678 ',
    countyId: 'c1',
    location: ' Westlands ',
    productId: 'p1',
    quantity: 2,
    landingSlug: 'prostguard',
    search: '?utm_source=facebook',
  };

  it('sends the order lines and tracking, and never a price', () => {
    const payload = buildOrderPayload(input);
    expect(payload).toMatchObject({
      customerName: 'Jane Doe',
      customerPhone: '0712 345 678',
      location: 'Westlands',
      items: [{ productId: 'p1', quantity: 2 }],
      landingSlug: 'prostguard',
      utmSource: 'facebook',
    });
    expect(JSON.stringify(payload)).not.toMatch(/price|total/i);
  });
});

describe('whatsappLink', () => {
  it('builds a click-to-chat link with an encoded message', () => {
    expect(whatsappLink('254712345678', 'Hi there & you')).toBe(
      'https://wa.me/254712345678?text=Hi%20there%20%26%20you',
    );
  });

  it('returns null for a missing or malformed number', () => {
    expect(whatsappLink(undefined, 'Hi')).toBeNull();
    expect(whatsappLink('', 'Hi')).toBeNull();
    expect(whatsappLink('+254712345678', 'Hi')).toBeNull();
    expect(whatsappLink('12', 'Hi')).toBeNull();
  });
});
