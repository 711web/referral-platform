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
  title: 'Partner — a half-built referral platform.',
  description:
    'Short-link tracking and dashboards work right now. Campaigns, payouts and AI captions land in four weeks. Free until then.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen overflow-x-clip">{children}</body>
    </html>
  );
}
