import { available, findShortfalls, type Level } from './stock-math.js';

const levels = (entries: Record<string, Level>) =>
  new Map(Object.entries(entries));

describe('stock math', () => {
  it('available is on hand minus reserved, and 0 for an unknown product', () => {
    expect(available({ onHand: 10, reserved: 3 })).toBe(7);
    expect(available(undefined)).toBe(0);
  });

  it('finds nothing missing when there is enough', () => {
    expect(
      findShortfalls(levels({ a: { onHand: 5, reserved: 2 } }), [
        { productId: 'a', quantity: 3 },
      ]),
    ).toEqual([]);
  });

  it('reports how much is available when short', () => {
    expect(
      findShortfalls(levels({ a: { onHand: 5, reserved: 2 } }), [
        { productId: 'a', quantity: 4 },
      ]),
    ).toEqual([{ productId: 'a', needed: 4, available: 3 }]);
  });

  it('treats a product the agent never received as zero stock', () => {
    expect(
      findShortfalls(levels({}), [{ productId: 'b', quantity: 1 }]),
    ).toEqual([{ productId: 'b', needed: 1, available: 0 }]);
  });

  it('adds up several lines of the same product', () => {
    expect(
      findShortfalls(levels({ a: { onHand: 5, reserved: 0 } }), [
        { productId: 'a', quantity: 3 },
        { productId: 'a', quantity: 3 },
      ]),
    ).toEqual([{ productId: 'a', needed: 6, available: 5 }]);
  });

  it('a negative available can never cover anything', () => {
    expect(
      findShortfalls(levels({ a: { onHand: 1, reserved: 3 } }), [
        { productId: 'a', quantity: 1 },
      ]),
    ).toEqual([{ productId: 'a', needed: 1, available: -2 }]);
  });
});
