import Link from 'next/link';
import { getProducts } from '../lib/api';
import { copy } from '../lib/copy';
import { formatKes } from '../lib/format';

// Not prerendered at build time, so building never needs the API. The data
// is still cached for a minute (see lib/api.ts).
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const products = await getProducts();
  return (
    <>
      <h1>{copy.homeHeading}</h1>
      {products.length === 0 && <p className="muted">{copy.homeEmpty}</p>}
      <ul className="products">
        {products.map((product) => {
          const lowest = Math.min(...product.prices.map((p) => p.priceKes));
          return (
            <li key={product.id}>
              <Link href={`/products/${product.slug}`} className="card block">
                <strong>{product.name}</strong>
                {Number.isFinite(lowest) && (
                  <span className="muted">
                    {copy.from} {formatKes(lowest)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
