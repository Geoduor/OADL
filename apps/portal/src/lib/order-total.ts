import type { Product } from './types.js';

// Display only: the server prices every order from the database and ignores
// anything the browser says about prices.
export function bundleTotal(
  products: Product[],
  chosen: Record<string, number>,
): number {
  let total = 0;
  for (const product of products) {
    const quantity = chosen[product.id];
    if (!quantity) continue;
    total +=
      product.prices.find((price) => price.quantity === quantity)?.priceKes ??
      0;
  }
  return total;
}
