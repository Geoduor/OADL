import { nairobiToday } from '../time/nairobi.js';
import { rangeStart } from './history-range.js';

describe('nairobiToday', () => {
  it('uses the Nairobi calendar day, not UTC', () => {
    // 22:30 UTC on the 26th is 01:30 on the 27th in Kenya.
    expect(nairobiToday(new Date('2026-11-26T22:30:00Z'))).toBe('2026-11-27');
    expect(nairobiToday(new Date('2026-11-26T20:59:00Z'))).toBe('2026-11-26');
  });
});

describe('rangeStart', () => {
  const now = new Date('2026-11-26T22:30:00Z'); // 27 Nov in Kenya

  it('starts today at midnight in Kenya', () => {
    expect(rangeStart('today', now)?.toISOString()).toBe(
      '2026-11-26T21:00:00.000Z',
    );
  });

  it('counts today as day one of the last 7 and 30 days', () => {
    expect(rangeStart('week', now)?.toISOString()).toBe(
      '2026-11-20T21:00:00.000Z',
    );
    expect(rangeStart('month', now)?.toISOString()).toBe(
      '2026-10-28T21:00:00.000Z',
    );
  });

  it('has no lower bound for all time', () => {
    expect(rangeStart('all', now)).toBeNull();
  });
});
