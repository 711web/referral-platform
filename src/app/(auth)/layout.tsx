import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
        <Link href="/" className="mb-6 block text-center text-lg font-semibold">
          Partner
        </Link>
        {children}
      </div>
    </main>
  );
}
