import { generateOrderNo } from './order-number.js';

describe('generateOrderNo', () => {
  it('uses the Nairobi date and four random digits', () => {
    // 21:30 UTC on 31 Dec is already 1 Jan in Nairobi (UTC+3).
    const now = new Date('2026-12-31T21:30:00Z');
    expect(generateOrderNo(now, () => 0.0042)).toBe('OADL-270101-0042');
  });

  it('pads the random part to four digits and never exceeds 9999', () => {
    const now = new Date('2026-11-22T10:00:00Z');
    expect(generateOrderNo(now, () => 0)).toBe('OADL-261122-0000');
    expect(generateOrderNo(now, () => 0.99999)).toBe('OADL-261122-9999');
  });
});
