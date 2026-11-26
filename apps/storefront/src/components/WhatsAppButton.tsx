import { copy } from '../lib/copy';
import { whatsappLink } from '../lib/order-payload';

// Click-to-chat only (docs/INTEGRATIONS.md). Hidden until the manager's
// number is set (Q9).
export function WhatsAppButton({ message }: { message: string }) {
  const link = whatsappLink(
    process.env['NEXT_PUBLIC_WHATSAPP_NUMBER'],
    message,
  );
  if (!link) return null;
  return (
    <a
      className="secondary"
      href={link}
      target="_blank"
      rel="noopener noreferrer"
    >
      {copy.talkToUs}
    </a>
  );
}
