import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WhatsAppButton } from '../../../components/WhatsAppButton';
import { copy } from '../../../lib/copy';

export const metadata: Metadata = {
  title: copy.thanksHeading,
  robots: { index: false },
};

// The page shows only the number from the address. There is no public order
// lookup, because that would expose customer details.
export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  if (!/^[A-Za-z0-9-]{4,40}$/.test(orderNo)) notFound();

  return (
    <>
      <h1>{copy.thanksHeading}</h1>
      <div className="card">
        <p className="muted">{copy.orderNumber}</p>
        <p className="orderno">{orderNo}</p>
        <p>{copy.whatNext}</p>
        <p className="muted">{copy.keepNumber}</p>
      </div>
      <WhatsAppButton message={`Hello, my order number is ${orderNo}.`} />
      <p>
        <Link href="/">{copy.backToShop}</Link>
      </p>
    </>
  );
}
