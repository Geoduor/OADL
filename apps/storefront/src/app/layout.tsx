import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { copy } from '../lib/copy';
import './globals.css';

// Needed so link previews get absolute image and page URLs.
const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'http://localhost:3001';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: copy.siteTitle,
  description: copy.siteDescription,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
