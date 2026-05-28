import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser } from '@/lib/workspaces/queries';
import { generateBrandCredentialsAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ revealed?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');
  const { revealed } = await searchParams;
  const hasCreds = Boolean(ws.brandKey);
  const showSecret = revealed === '1';

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <header>
        <Link
          href="/app"
          className="text-sm text-[var(--muted)] underline-offset-4 hover:underline"
        >
          ← back
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Workspace settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Workspace: <span className="font-medium text-[var(--fg)]">{ws.name}</span> ·
          kind: <span className="font-medium text-[var(--fg)]">{ws.kind}</span>
        </p>
      </header>

      <section className="rounded-lg border border-[var(--border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Brand credentials</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Brand credentials let you send conversions to{' '}
          <code className="rounded bg-slate-100 px-1 text-[12px]">/api/conversion</code>.
          Generating credentials switches this workspace to <code>kind=brand</code>.
        </p>

        {!hasCreds && (
          <form action={generateBrandCredentialsAction} className="mt-6">
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Generate brand credentials
            </button>
          </form>
        )}

        {hasCreds && (
          <div className="mt-6 space-y-3 font-mono text-[12px]">
            <div>
              <span className="text-[var(--muted)]">brand_key</span>
              <div className="mt-1 break-all rounded-md border border-[var(--border)] bg-slate-50 p-3">
                {ws.brandKey}
              </div>
            </div>
            <div>
              <span className="text-[var(--muted)]">brand_secret</span>
              <div className="mt-1 break-all rounded-md border border-[var(--border)] bg-slate-50 p-3">
                {showSecret ? ws.brandSecret : '••• hidden — regenerate to reveal again •••'}
              </div>
            </div>
            <form action={generateBrandCredentialsAction}>
              <button
                type="submit"
                onClick={(e) => {
                  if (!confirm('Rotate credentials? Old key + secret will stop working.')) {
                    e.preventDefault();
                  }
                }}
                className="cursor-pointer text-[12px] text-red-600 underline-offset-4 hover:underline"
              >
                Rotate credentials
              </button>
            </form>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Sending conversions</h2>

        <h3 className="mt-5 text-sm font-medium">1. Webhook (server-to-server, HMAC-signed)</h3>
        <pre className="mt-2 overflow-x-auto rounded-md border border-[var(--border)] bg-slate-50 p-3 font-mono text-[11.5px] leading-[1.55]">{`POST https://partner.711web.com/api/conversion
Headers:
  Content-Type:   application/json
  X-Brand-Key:    ${ws.brandKey ?? 'pk_…'}
  X-Signature:    <sha256-hmac-of-body-using-brand_secret>

Body:
  {
    "click_id":  "01H2VKZ…RVA",
    "amount":    49.00,
    "currency":  "USD",
    "order_id":  "ord_123"
  }`}</pre>

        <h3 className="mt-6 text-sm font-medium">2. JS pixel (drop into your thank-you page)</h3>
        <pre className="mt-2 overflow-x-auto rounded-md border border-[var(--border)] bg-slate-50 p-3 font-mono text-[11.5px] leading-[1.55]">{`<script async src="https://partner.711web.com/pixel.js"
        data-brand-key="${ws.brandKey ?? 'pk_…'}"
        data-amount="49.00"
        data-currency="USD"
        data-order-id="ord_123"></script>`}</pre>
      </section>
    </div>
  );
}
