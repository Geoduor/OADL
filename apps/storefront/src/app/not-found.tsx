import Link from 'next/link';
import { copy } from '../lib/copy';

export default function NotFound() {
  return (
    <>
      <h1>{copy.notFound}</h1>
      <p>
        <Link href="/">{copy.backToShop}</Link>
      </p>
    </>
  );
}
