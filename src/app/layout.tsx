import type { ReactNode } from 'react';
import { Amatic_SC, Cabin } from 'next/font/google';
import './globals.css';

const display = Amatic_SC({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-display',
  display: 'swap',
});

const body = Cabin({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata = {
  title: 'Partner — the open referral stack.',
  description:
    'Short-link tracking, campaigns, AI captions, conversion attribution, and Stripe payouts. The full stack runs at partner.711web.com today. Open source. Free during early access.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen overflow-x-clip">{children}</body>
    </html>
  );
}
