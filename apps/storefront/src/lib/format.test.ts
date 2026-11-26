import { describe, expect, it } from 'vitest';
import { formatKes } from './format';

describe('formatKes', () => {
  it('groups thousands', () => {
    expect(formatKes(3999)).toBe('KES 3,999');
    expect(formatKes(7000)).toBe('KES 7,000');
    expect(formatKes(500)).toBe('KES 500');
  });
});
