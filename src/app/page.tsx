import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">Partner</h1>
      <p className="max-w-md text-[var(--muted)]">
        Short-link tracking for creators and brands. AI-powered campaigns coming soon.
      </p>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
