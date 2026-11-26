import { describe, expect, it } from 'vitest';
import { formatKes, formatNairobi, nairobiDate } from './format.js';

describe('formatKes', () => {
  it('writes whole shillings with thousands separators', () => {
    expect(formatKes(5500)).toBe('KES 5,500');
    expect(formatKes(999)).toBe('KES 999');
  });
});

describe('formatNairobi', () => {
  it('shows a UTC instant in Kenya time (UTC+3)', () => {
    expect(formatNairobi('2026-11-25T21:30:00.000Z')).toBe(
      '26 Nov 2026, 00:30',
    );
    expect(formatNairobi('2026-11-25T08:05:00.000Z')).toBe(
      '25 Nov 2026, 11:05',
    );
  });
});

describe('nairobiDate', () => {
  it('uses the Nairobi day, which starts at 21:00 UTC', () => {
    const justAfterNairobiMidnight = new Date('2026-01-10T21:30:00Z');
    expect(nairobiDate(justAfterNairobiMidnight)).toBe('2026-01-11');
    expect(nairobiDate(new Date('2026-01-10T20:30:00Z'))).toBe('2026-01-10');
  });

  it('steps back whole days', () => {
    expect(nairobiDate(new Date('2026-01-11T09:00:00Z'), 6)).toBe('2026-01-05');
  });
});
