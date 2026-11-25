import { bundleTotal } from './order-total.js';
import type { Product } from './types.js';

const products: Product[] = [
  {
    id: 'a',
    name: 'PROSTGUARD',
    slug: 'prostguard',
    prices: [
      { quantity: 1, priceKes: 3999, compareAtPriceKes: null },
      { quantity: 2, priceKes: 5500, compareAtPriceKes: null },
    ],
  },
];

describe('bundleTotal', () => {
  it('adds the price of each chosen bundle', () => {
    expect(bundleTotal(products, { a: 2 })).toBe(5500);
  });

  it('ignores products with no bundle chosen or an unknown bundle', () => {
    expect(bundleTotal(products, {})).toBe(0);
    expect(bundleTotal(products, { a: 9 })).toBe(0);
  });
});
