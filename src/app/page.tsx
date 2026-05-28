import Link from 'next/link';
import { LiveLedger } from '@/components/marketing/live-ledger';

const TODAY = '2026-05-28';

export default function HomePage() {
  return (
    <main className="relative overflow-x-clip">
      {/* Top meta strip */}
      <div className="border-b border-[var(--rule)]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3 mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-2)]">
          <span>Partner · Ledger Office</span>
          <span className="hidden sm:inline">
            Doc № 0001 · {TODAY} · London
          </span>
          <span className="sm:hidden">№ 0001</span>
        </div>
      </div>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1200px] grid-cols-1 gap-16 px-6 py-16 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-12 md:py-24">
        <div>
          <div
            className="fade mb-6 mono text-[11px] uppercase tracking-[0.24em] text-[var(--rouge)]"
            style={{ animationDelay: '0.05s' }}
          >
            ¶ A receipts-first referral platform
          </div>

          <h1 className="display text-[clamp(56px,10vw,140px)] tracking-tight">
            <span className="word" style={{ animationDelay: '0.10s' }}>
              Every
            </span>{' '}
            <span className="word" style={{ animationDelay: '0.22s' }}>
              share,
            </span>
            <br />
            <span className="word" style={{ animationDelay: '0.34s' }}>
              accounted
            </span>{' '}
            <span
              className="word text-[var(--rouge)]"
              style={{ animationDelay: '0.46s' }}
            >
              for.
            </span>
          </h1>

          <p
            className="rise mt-10 max-w-[44ch] text-[17px] leading-[1.55] text-[var(--ink-2)]"
            style={{ animationDelay: '0.62s' }}
          >
            Short links with proper attribution. Campaigns brands can run.
            Payouts creators can trust. We log every click, attribute every
            conversion, and keep both sides honest.{' '}
            <span className="text-[var(--ink)]">Free while we're early.</span>
          </p>

          <div
            className="rise mt-10 flex flex-wrap items-center gap-3"
            style={{ animationDelay: '0.74s' }}
          >
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 bg-[var(--ink)] px-5 py-3 text-[14px] font-medium text-[var(--paper)] transition hover:bg-[var(--rouge)]"
            >
              Open an account
              <span
                aria-hidden="true"
                className="transition group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
            <Link
              href="/go/demo"
              className="group inline-flex items-center gap-2 border border-[var(--rule-strong)] px-5 py-3 mono text-[11.5px] uppercase tracking-[0.18em] text-[var(--ink)] transition hover:bg-[var(--ink)] hover:text-[var(--paper)]"
            >
              See a redirect →
            </Link>
          </div>

          <p
            className="rise mt-8 flex items-center gap-2 mono text-[10.5px] uppercase tracking-[0.2em] text-[var(--ink-2)]"
            style={{ animationDelay: '0.86s' }}
          >
            <span className="block size-1.5 animate-pulse rounded-full bg-[var(--rouge)]" />
            Live in production · partner.711web.com
          </p>
        </div>

        <div
          className="fade self-center md:pl-4"
          style={{ animationDelay: '0.50s' }}
        >
          <LiveLedger />
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-y border-[var(--rule)] bg-[var(--paper-2)]/60">
        <div
          className="flex w-max gap-12 whitespace-nowrap py-3 mono text-[12px] uppercase tracking-[0.22em] text-[var(--ink)]"
          style={{ animation: 'marquee 42s linear infinite' }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="flex items-center gap-10">
              <span>Workspace-scoped links</span>
              <span className="text-[var(--rouge)]">✦</span>
              <span>Webhook + pixel attribution</span>
              <span className="text-[var(--rouge)]">✦</span>
              <span>Async batch click logging</span>
              <span className="text-[var(--rouge)]">✦</span>
              <span>AI copy generator · Slice 5</span>
              <span className="text-[var(--rouge)]">✦</span>
              <span>Stripe Connect payouts · Slice 6</span>
              <span className="text-[var(--rouge)]">✦</span>
              <span>Self-hosted · single box</span>
              <span className="text-[var(--rouge)]">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="grid grid-cols-1 gap-14 md:grid-cols-[1fr_1.4fr]">
          <div className="md:pt-2">
            <div className="mono text-[10.5px] uppercase tracking-[0.24em] text-[var(--ink-2)]">
              Section 02 · The mechanism
            </div>
            <h2 className="display mt-4 text-[clamp(40px,6.5vw,80px)] leading-[0.95]">
              How a click
              <br /> becomes a payout.
            </h2>
            <p className="mt-6 max-w-[34ch] text-[15px] leading-[1.55] text-[var(--ink-2)]">
              Four steps from a tap on a link to a creator getting paid. No
              opaque attribution. No reconciliation spreadsheets.
            </p>
          </div>

          <ol className="flex flex-col border-t border-[var(--rule)]">
            {[
              [
                'You paste a destination URL.',
                'We mint a short slug scoped to your workspace. Bring your own domain whenever you want.',
              ],
              [
                'Someone clicks.',
                'Edge hits Redis. We set a 30-day cookie, append UTM, and 302 in under 80 ms in-region.',
              ],
              [
                'Conversion fires.',
                'Webhook or pixel — your call. We attribute last-click and accrue commission to the right creator.',
              ],
              [
                'Settlement runs.',
                'Today: clean CSV export. Soon: Stripe Connect, daily, with anti-fraud guardrails.',
              ],
            ].map(([title, body], i) => (
              <li
                key={i}
                className="grid grid-cols-[44px_1fr] items-baseline gap-6 border-b border-dotted border-[var(--rule)] py-7"
              >
                <span className="mono tnum text-[13px] text-[var(--rouge)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="display text-[28px] leading-[1.05]">{title}</h3>
                  <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.55] text-[var(--ink-2)]">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Vitals */}
      <section className="border-y border-[var(--rule)] bg-[var(--paper-2)]/50">
        <div className="mx-auto max-w-[1200px] px-6 py-6">
          <div className="mb-4 mono text-[10.5px] uppercase tracking-[0.24em] text-[var(--ink-2)]">
            Section 03 · Honest specs
          </div>
        </div>
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 border-t border-[var(--rule)] md:grid-cols-4">
          {[
            ['Edge redirect', '≤ 80', 'ms p95 in-region'],
            ['Attribution', '30', 'day last-click window'],
            ['Hosted on', '1', 'Linux box · UK'],
            ['Pricing', '$0', 'while we build Slices 3–6'],
          ].map(([label, big, sub], i) => (
            <div
              key={i}
              className={`flex flex-col gap-3 p-8 ${
                i < 3 ? 'md:border-r md:border-[var(--rule)]' : ''
              } ${i === 0 || i === 2 ? 'border-r border-[var(--rule)] md:border-r' : ''} ${
                i < 2 ? 'border-b border-[var(--rule)] md:border-b-0' : ''
              }`}
            >
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-2)]">
                {label}
              </div>
              <div className="display text-[clamp(48px,7vw,84px)] leading-[1] text-[var(--ink)]">
                {big}
              </div>
              <div className="mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink-2)]">
                {sub}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Two columns: creators / brands */}
      <section className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="mb-12 mono text-[10.5px] uppercase tracking-[0.24em] text-[var(--ink-2)]">
          Section 04 · Two sides, one ledger
        </div>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          {[
            {
              tag: 'For creators',
              title: 'Every affiliate link, one ledger.',
              body: [
                'Bring any affiliate or referral URL. Track clicks across every platform.',
                'AI captions per platform — IG, TikTok, X. (Slice 5)',
                'Earn on platform campaigns, your direct deals, or both.',
              ],
              cta: 'Sign up free',
              href: '/signup',
            },
            {
              tag: 'For brands',
              title: 'A campaign live in under a minute.',
              body: [
                'Hand tracking links to creators you already know.',
                'Conversion via server webhook or our drop-in pixel.',
                'See clicks → conversions → accrued commissions live.',
              ],
              cta: 'Start a campaign',
              href: '/signup',
            },
          ].map((col, i) => (
            <article
              key={i}
              className="flex flex-col border border-[var(--rule)] bg-[var(--paper)] p-8 shadow-[4px_4px_0_var(--rule-soft)]"
            >
              <div className="mono text-[11px] uppercase tracking-[0.24em] text-[var(--rouge)]">
                {col.tag}
              </div>
              <h3 className="display mt-3 text-[clamp(28px,3.4vw,40px)] leading-[1.04]">
                {col.title}
              </h3>
              <ul className="mt-7 flex flex-col gap-3 text-[15px] leading-[1.55] text-[var(--ink-2)]">
                {col.body.map((line, j) => (
                  <li key={j} className="grid grid-cols-[14px_1fr] items-baseline gap-3">
                    <span className="mono tnum text-[12px] text-[var(--rouge)]">
                      {String(j + 1).padStart(2, '0')}
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={col.href}
                className="mt-10 inline-flex w-fit items-center gap-2 mono text-[12px] uppercase tracking-[0.2em] text-[var(--ink)] underline-offset-[6px] hover:underline"
              >
                {col.cta}
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[var(--rule)] bg-[var(--paper-2)]/40">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-14 px-6 py-24 md:grid-cols-[1fr_1.6fr]">
          <div>
            <div className="mono text-[10.5px] uppercase tracking-[0.24em] text-[var(--ink-2)]">
              Section 05 · Q & A
            </div>
            <h2 className="display mt-4 text-[clamp(40px,6.5vw,72px)] leading-[0.95]">
              Things people
              <br /> ask.
            </h2>
          </div>
          <dl className="flex flex-col">
            {[
              [
                'Is this another dub.co clone?',
                "No — dub doesn't pay creators. Refferly pays creators but the link infrastructure is opaque. We do both, honestly.",
              ],
              [
                'Why not Bitly + a spreadsheet?',
                'Two tools, manual sync, monthly reconciliation. Also they\'re not free at any meaningful volume.',
              ],
              [
                'Where does my data live?',
                'Postgres on a single UK box. Backups nightly. Your workspace, your data, your domain.',
              ],
              [
                'When can I take real payouts?',
                'CSV export today. Stripe Connect lands in Slice 5 — the roadmap is visible in the repo.',
              ],
              [
                'Open source?',
                'Yes. github.com/711web/referral-platform. Tracked links and clicks for this very page logged here too.',
              ],
            ].map(([q, a], i) => (
              <div
                key={i}
                className="grid grid-cols-[52px_1fr] items-baseline gap-6 border-t border-dotted border-[var(--rule)] py-7 first:border-t-0"
              >
                <span className="mono tnum text-[12px] text-[var(--rouge)]">
                  Q.{String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <dt className="display text-[22px] leading-snug">{q}</dt>
                  <dd className="mt-2 text-[15px] leading-[1.55] text-[var(--ink-2)]">
                    {a}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Final CTA panel — receipt-style */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24 pt-24">
        <div className="border border-[var(--ink)] bg-[var(--paper)] shadow-[8px_8px_0_var(--ink)]">
          <div className="border-b border-dashed border-[var(--ink)] px-8 py-3 mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-2)]">
            Final ledger entry · take what you need
          </div>
          <div className="grid grid-cols-1 gap-8 px-8 py-12 md:grid-cols-[1.4fr_1fr] md:items-end">
            <h2 className="display text-[clamp(40px,6.5vw,84px)] leading-[0.96]">
              Start tracking{' '}
              <span className="text-[var(--rouge)]">honestly.</span>
              <br /> Today.
            </h2>
            <div className="flex flex-col gap-3">
              <Link
                href="/signup"
                className="group inline-flex items-center justify-between gap-2 bg-[var(--ink)] px-5 py-4 text-[14px] font-medium text-[var(--paper)] transition hover:bg-[var(--rouge)]"
              >
                Open an account
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/go/demo"
                className="inline-flex items-center justify-between border border-[var(--rule-strong)] px-5 py-4 mono text-[11.5px] uppercase tracking-[0.18em] text-[var(--ink)] transition hover:bg-[var(--ink)] hover:text-[var(--paper)]"
              >
                See a real redirect
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="https://github.com/711web/referral-platform"
                className="inline-flex items-center justify-between mono text-[11.5px] uppercase tracking-[0.18em] text-[var(--ink-2)] hover:text-[var(--rouge)]"
              >
                Read the source
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <span className="torn-edge" aria-hidden="true" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--rule-strong)] px-6 pb-16 pt-12">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="display text-[44px] leading-[1] text-[var(--ink)]">
                Partner.
              </div>
              <div className="mt-2 mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-2)]">
                partner.711web.com
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 mono text-[11.5px] uppercase tracking-[0.18em]">
              <Link href="/signup" className="hover:text-[var(--rouge)]">
                Sign up
              </Link>
              <Link href="/login" className="hover:text-[var(--rouge)]">
                Log in
              </Link>
              <a
                href="https://github.com/711web/referral-platform"
                className="hover:text-[var(--rouge)]"
              >
                GitHub
              </a>
              <Link href="/go/demo" className="hover:text-[var(--rouge)]">
                See a redirect
              </Link>
            </nav>
          </div>
          <div className="flex flex-col justify-between gap-3 border-t border-dotted border-[var(--rule)] pt-6 mono text-[10.5px] uppercase tracking-[0.2em] text-[var(--ink-2)] sm:flex-row">
            <span>Doc № 0001 · {TODAY} · London</span>
            <span>Built with conviction this week. Live now. Free during build-out.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
