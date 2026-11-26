import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrderForm } from '../../../components/OrderForm';
import { WhatsAppButton } from '../../../components/WhatsAppButton';
import { getCounties, getProduct } from '../../../lib/api';
import { copy } from '../../../lib/copy';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

// Only show an image address that is safe to load.
function safeImage(url: string | null): string | null {
  return url && (url.startsWith('https://') || url.startsWith('/'))
    ? url
    : null;
}

// Facebook reads these tags from the server HTML (docs: generateMetadata).
// The same fetch is reused by the page below (Next.js memoises it).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  const description = product.description ?? copy.siteDescription;
  const image = safeImage(product.imageUrl);
  return {
    title: product.name,
    description,
    openGraph: {
      type: 'website',
      title: product.name,
      description,
      url: `/products/${product.slug}`,
      locale: 'en_KE',
      ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, counties] = await Promise.all([
    getProduct(slug),
    getCounties(),
  ]);
  if (!product) notFound();
  const image = safeImage(product.imageUrl);

  return (
    <>
      <h1>{product.name}</h1>
      {image && (
        // A plain image: the address comes from our own catalogue.
        // oxlint-disable-next-line nextjs/no-img-element
        <img className="hero" src={image} alt={product.name} />
      )}
      {product.description && <p>{product.description}</p>}
      <OrderForm product={product} counties={counties} />
      <WhatsAppButton
        message={`Hello, I have a question about ${product.name}.`}
      />
    </>
  );
}
