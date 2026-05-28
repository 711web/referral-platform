'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Stats = {
  clicksToday: number;
  totalClicks: number;
  totalLinks: number;
  totalAccounts: number;
};

const CAPABILITIES: Array<{
  title: string;
  body: string;
  status: 'shipped' | 'soon';
  color: 'cream' | 'pink' | 'orange' | 'berry' | 'pink-soft';
  rotate: number;
  span?: 'wide' | 'tall';
}> = [
  {
    title: 'Short links',
    body: '/go/<slug> with a 30-day cookie. Sub-80ms redirect in-region.',
    status: 'shipped',
    color: 'cream',
    rotate: -1.5,
  },
  {
    title: 'Click tracking',
    body: 'Async batch logger into Postgres. Geo, device, referrer.',
    status: 'shipped',
    color: 'pink',
    rotate: 1.2,
  },
  {
    title: 'Workspace dashboards',
    body: 'Sign up, get a workspace, manage every link in one place.',
    status: 'shipped',
    color: 'orange',
    rotate: -0.8,
  },
  {
    title: 'Webhook + pixel attribution',
    body: 'Drop-in JS pixel OR HMAC-signed server webhook. Last-click, 30 days.',
    status: 'soon',
    color: 'pink-soft',
    rotate: 0.5,
    span: 'wide',
  },
  {
    title: 'Campaigns',
    body: 'Brands post offers; creators join. Per-creator tracking links minted.',
    status: 'soon',
    color: 'cream',
    rotate: -1,
  },
  {
    title: 'AI captions',
    body: 'IG / TikTok / X. Priced in credit packs.',
    status: 'soon',
    color: 'berry',
    rotate: 1.6,
  },
  {
    title: 'Stripe Connect payouts',
    body: 'Daily settlement. Anti-fraud guardrails. Multi-currency.',
    status: 'soon',
    color: 'orange',
    rotate: -1.3,
  },
];

const EASE = [0.2, 0.7, 0.2, 1] as const;

/* Hero entrance — opacity fade is OK because it fires on mount, always */
const FADE_IN = {
  hidden: { opacity: 0, y: 24, rotate: 0 },
  show: (rot: number = 0) => ({
    opacity: 1,
    y: 0,
    rotate: rot,
    transition: { duration: 0.55, ease: EASE },
  }),
};

/* Below-fold entrance — keep opacity 1 so SSR/screenshots render visible */
const RISE_IN = {
  hidden: { y: 24, rotate: 0 },
  show: (rot: number = 0) => ({
    y: 0,
    rotate: rot,
    transition: { duration: 0.55, ease: EASE },
  }),
};

function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const prefersReduced = useReducedMotion();
  const [shown, setShown] = useState(prefersReduced ? value : 0);

  useEffect(() => {
    if (prefersReduced) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, prefersReduced]);

  return (
    <span className="tnum">
      {shown.toLocaleString()}
      {suffix}
    </span>
  );
}

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ y: 28 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function Landing({ stats, today }: { stats: Stats; today: string }) {
  return (
    <main className="relative">
      {/* Tape strip */}
      <div className="tape h-2 w-full" />

      {/* Top meta */}
      <div className="border-b border-[var(--rule)]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--berry)]">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="block size-3 rotate-12 bg-[var(--orange)]" />
            Partner — Open ledger
          </span>
          <span className="hidden text-[var(--berry-2)] sm:inline">
            {today} · London · v0.2 · half-built
          </span>
        </div>
      </div>

      {/* HERO BLOCK GRID */}
      <section className="mx-auto max-w-[1180px] px-6 pb-12 pt-16 md:pt-24">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-12 grid-rows-[auto] gap-5"
        >
          {/* Hero copy block — spans 8 columns on desktop */}
          <motion.div
            variants={FADE_IN}
            custom={-0.6}
            className="sticker sticker-cream relative col-span-12 p-8 md:col-span-8 md:p-12"
          >
            <span className="stamp">SHIPPED THIS WEEK</span>
            <h1 className="mt-6 text-[clamp(48px,7vw,96px)] font-bold leading-[1.02] tracking-tight text-[var(--berry)]">
              A half-built
              <br />
              <span className="font-display text-[1.18em] font-bold leading-[0.86] text-[var(--orange)]">
                referral platform.
              </span>
            </h1>
            <p className="mt-6 max-w-[44ch] text-[18px] leading-[1.55] text-[var(--berry)]">
              Short-link tracking and dashboards work right now. Campaigns,
              payouts and AI captions land in the next four weeks. Free until
              they all ship.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="group inline-flex cursor-pointer items-center gap-2 rounded-md border-2 border-[var(--berry)] bg-[var(--orange)] px-5 py-3 text-[15px] font-bold uppercase tracking-wide text-[var(--cream)] shadow-[4px_4px_0_var(--berry)] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-[var(--orange-2)] hover:shadow-[2px_2px_0_var(--berry)]"
              >
                Open an account
                <span aria-hidden="true" className="transition group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <Link
                href="/go/demo"
                prefetch={false}
                className="cursor-pointer rounded-md border-2 border-[var(--berry)] bg-[var(--cream)] px-5 py-3 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--berry)] transition hover:bg-[var(--berry)] hover:text-[var(--cream)]"
              >
                See a real redirect →
              </Link>
            </div>
          </motion.div>

          {/* Live count tile */}
          <motion.div
            variants={FADE_IN}
            custom={1.4}
            className="sticker sticker-pink col-span-6 flex flex-col justify-between p-6 md:col-span-4 md:row-span-2 md:p-8"
          >
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em]">
              <span>Live in the last 24h</span>
              <span aria-hidden="true" className="block size-2 animate-pulse rounded-full bg-[var(--cream)]" />
            </div>
            <div className="my-6 flex items-baseline gap-3">
              <span className="font-display text-[clamp(96px,18vw,180px)] font-bold leading-[0.78]">
                <Counter value={stats.clicksToday} />
              </span>
              <span className="text-[18px] font-semibold uppercase tracking-wide">
                clicks
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t-2 border-[var(--cream)]/30 pt-5 text-[12px] uppercase tracking-[0.14em]">
              <div>
                <dt className="opacity-80">Total clicks</dt>
                <dd className="mt-1 text-[22px] font-bold leading-none">
                  <Counter value={stats.totalClicks} />
                </dd>
              </div>
              <div>
                <dt className="opacity-80">Short links</dt>
                <dd className="mt-1 text-[22px] font-bold leading-none">
                  <Counter value={stats.totalLinks} />
                </dd>
              </div>
              <div>
                <dt className="opacity-80">Accounts</dt>
                <dd className="mt-1 text-[22px] font-bold leading-none">
                  <Counter value={stats.totalAccounts} />
                </dd>
              </div>
              <div>
                <dt className="opacity-80">Price</dt>
                <dd className="mt-1 text-[22px] font-bold leading-none">$0</dd>
              </div>
            </dl>
          </motion.div>

          {/* Big handwritten zero */}
          <motion.div
            variants={FADE_IN}
            custom={-1.8}
            className="sticker sticker-berry col-span-6 flex flex-col items-center justify-center p-6 md:col-span-4 md:p-8"
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--pink-2)]">
              What you pay
            </div>
            <div className="font-display text-[clamp(120px,22vw,220px)] font-bold leading-[0.78] text-[var(--orange-2)]">
              $0
            </div>
            <div className="mt-1 text-[12px] uppercase tracking-[0.16em] text-[var(--cream)]">
              until v1.0 ships
            </div>
          </motion.div>

          {/* Source link block */}
          <motion.div
            variants={FADE_IN}
            custom={0.9}
            className="sticker sticker-orange col-span-6 flex flex-col justify-between p-6 md:col-span-4 md:p-8"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
              Open source
            </span>
            <div>
              <div className="font-display text-[clamp(38px,5vw,60px)] font-bold leading-none">
                github.com /
                <br /> 711web / referral-platform
              </div>
            </div>
            <a
              href="https://github.com/711web/referral-platform"
              className="mt-4 inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border-2 border-[var(--cream)] px-3 py-2 text-[12px] font-bold uppercase tracking-[0.14em] transition hover:bg-[var(--cream)] hover:text-[var(--orange)]"
            >
              Read the source →
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* Capability marquee */}
      <Reveal>
        <div className="overflow-hidden border-y-2 border-[var(--berry)] bg-[var(--berry)] py-3 text-[var(--cream)]">
          <div
            className="flex w-max gap-8 whitespace-nowrap text-[15px] font-bold uppercase tracking-[0.16em]"
            style={{ animation: 'marquee 38s linear infinite' }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className="flex items-center gap-8">
                <span>Sign up free</span>
                <span className="text-[var(--orange-2)]">✦</span>
                <span>Track every click</span>
                <span className="text-[var(--orange-2)]">✦</span>
                <span>Workspaces for teams</span>
                <span className="text-[var(--orange-2)]">✦</span>
                <span>Stripe payouts soon</span>
                <span className="text-[var(--orange-2)]">✦</span>
                <span>AI captions soon</span>
                <span className="text-[var(--orange-2)]">✦</span>
                <span>Self-hosted single box</span>
                <span className="text-[var(--orange-2)]">✦</span>
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      {/* CAPABILITY WALL — wall of stickers */}
      <section className="mx-auto max-w-[1180px] px-6 py-20">
        <Reveal>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="stamp">The ledger</span>
              <h2 className="mt-4 text-[clamp(36px,5vw,72px)] font-bold leading-[1.02] tracking-tight text-[var(--berry)]">
                What's <span className="font-display text-[1.18em] font-bold text-[var(--pink)]">shipped</span> /{' '}
                <span className="font-display text-[1.18em] font-bold text-[var(--orange)]">soon</span>.
              </h2>
            </div>
            <p className="max-w-[36ch] text-[15px] leading-[1.55] text-[var(--berry-2)]">
              No fake roadmap badges, no "Q2 2026 promises". If it's here as
              SHIPPED you can sign up and use it today.
            </p>
          </div>
        </Reveal>

        <motion.ul
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
          className="grid grid-cols-12 gap-5"
        >
          {CAPABILITIES.map((c, i) => (
            <motion.li
              key={i}
              variants={RISE_IN}
              custom={c.rotate}
              whileHover={{
                rotate: 0,
                y: -4,
                transition: { duration: 0.2 },
              }}
              className={`sticker sticker-${c.color} col-span-12 cursor-default p-6 md:p-7 ${
                c.span === 'wide' ? 'md:col-span-8' : 'md:col-span-4'
              }`}
              style={{
                transformOrigin: 'center',
              }}
            >
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em]">
                <span className={c.status === 'shipped' ? 'text-[var(--orange)]' : 'opacity-60'}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10px] ${
                    c.status === 'shipped'
                      ? 'border-current'
                      : 'border-current opacity-70'
                  }`}
                >
                  {c.status === 'shipped' ? '✓ live' : '◌ soon'}
                </span>
              </div>
              <h3 className="mt-5 text-[24px] font-bold leading-[1.1]">
                {c.title}
              </h3>
              <p className="mt-3 text-[14.5px] leading-[1.55] opacity-85">
                {c.body}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      {/* Mechanism — how a click becomes a payout */}
      <section className="border-y-2 border-[var(--berry)] bg-[var(--cream)] py-20">
        <div className="mx-auto max-w-[1180px] px-6">
          <Reveal>
            <span className="stamp">The mechanism</span>
            <h2 className="mt-4 max-w-[14ch] text-[clamp(40px,6vw,84px)] font-bold leading-[1] tracking-tight text-[var(--berry)]">
              How a click becomes a{' '}
              <span className="font-display text-[1.18em] font-bold text-[var(--orange)]">
                payout.
              </span>
            </h2>
          </Reveal>

          <ol className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-4">
            {[
              ['01', 'Paste a URL', 'Get a short slug under your workspace. BYO domain whenever.'],
              ['02', 'Someone clicks', 'Edge hits Redis. Cookie set. 302 in <80ms. UTM appended.'],
              ['03', 'Conversion fires', 'Webhook OR pixel. We attribute last-click and accrue commission.'],
              ['04', 'Settlement runs', 'CSV today. Daily Stripe Connect payouts in Slice 6.'],
            ].map(([n, title, body], i) => (
              <Reveal key={i} delay={i * 0.06}>
                <div className="flex h-full flex-col gap-3 border-t-4 border-[var(--berry)] pt-5">
                  <span className="font-display text-[64px] font-bold leading-none text-[var(--pink)]">
                    {n}
                  </span>
                  <h3 className="text-[20px] font-bold leading-tight text-[var(--berry)]">
                    {title}
                  </h3>
                  <p className="text-[14.5px] leading-[1.55] text-[var(--berry-2)]">
                    {body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Q & A */}
      <section className="mx-auto max-w-[1180px] px-6 py-24">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1fr_1.8fr]">
          <Reveal>
            <div>
              <span className="stamp">Q &amp; A</span>
              <h2 className="mt-4 text-[clamp(36px,5vw,68px)] font-bold leading-[0.98] tracking-tight text-[var(--berry)]">
                Things <br />
                <span className="font-display text-[1.18em] font-bold text-[var(--pink)]">
                  people ask.
                </span>
              </h2>
            </div>
          </Reveal>

          <dl className="flex flex-col">
            {[
              [
                'Is this just another dub.co?',
                "No — dub doesn't pay creators. Refferly pays creators but their link stack is opaque. We do both, in the open.",
              ],
              [
                'Why not Bitly + a spreadsheet?',
                'Two tools, manual sync, monthly reconciliation, neither free. We do all of it in one ledger.',
              ],
              [
                'Where does my data live?',
                'Postgres on one UK Linux box. Backups nightly. Your workspace, your data, your domain.',
              ],
              [
                'When can I take real payouts?',
                'CSV export today. Stripe Connect lands in Slice 6 (~3 weeks). Roadmap is in the repo.',
              ],
              [
                'Will you ever charge?',
                'Yes — AI features will be credit-priced when they land. Link tracking stays free up to fair usage.',
              ],
            ].map(([q, a], i) => (
              <Reveal key={i} delay={i * 0.04}>
                <div className="grid grid-cols-[40px_1fr] items-baseline gap-5 border-t-2 border-dotted border-[var(--rule)] py-7 first:border-t-0">
                  <span className="font-display text-[42px] font-bold leading-none text-[var(--orange)]">
                    Q{String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <dt className="text-[20px] font-bold leading-snug text-[var(--berry)]">
                      {q}
                    </dt>
                    <dd className="mt-2 text-[15px] leading-[1.6] text-[var(--berry-2)]">
                      {a}
                    </dd>
                  </div>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* Final big block CTA */}
      <section className="px-6 pb-20">
        <Reveal>
          <div className="sticker sticker-pink mx-auto flex max-w-[1180px] flex-col items-start gap-8 p-10 md:flex-row md:items-end md:justify-between md:p-16">
            <div>
              <span
                className="stamp"
                style={{ borderColor: 'var(--cream)', color: 'var(--cream)' }}
              >
                Final ledger entry
              </span>
              <h2 className="mt-5 text-[clamp(44px,7vw,108px)] font-bold leading-[0.95] tracking-tight">
                Start tracking
                <br />
                <span className="font-display text-[1.18em] font-bold text-[var(--cream)]">
                  honestly.
                </span>{' '}
                Today.
              </h2>
            </div>
            <div className="flex w-full flex-col gap-3 md:w-auto">
              <Link
                href="/signup"
                className="group inline-flex cursor-pointer items-center justify-between gap-4 rounded-md border-2 border-[var(--berry)] bg-[var(--orange)] px-6 py-4 text-[16px] font-bold uppercase tracking-wide text-[var(--cream)] shadow-[5px_5px_0_var(--berry)] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-[var(--orange-2)] hover:shadow-[3px_3px_0_var(--berry)]"
              >
                Open an account
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/go/demo"
                prefetch={false}
                className="inline-flex cursor-pointer items-center justify-between gap-4 rounded-md border-2 border-[var(--cream)] px-6 py-3 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--cream)] transition hover:bg-[var(--cream)] hover:text-[var(--pink)]"
              >
                See a real redirect
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-[var(--berry)] bg-[var(--paper)] px-6 py-12">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="font-display text-[64px] font-bold leading-none text-[var(--berry)]">
                Partner.
              </div>
              <div className="mt-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--berry-2)]">
                partner.711web.com
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[12px] font-bold uppercase tracking-[0.16em]">
              <Link className="cursor-pointer text-[var(--berry)] hover:text-[var(--orange)]" href="/signup">
                Sign up
              </Link>
              <Link className="cursor-pointer text-[var(--berry)] hover:text-[var(--orange)]" href="/login">
                Log in
              </Link>
              <a
                className="cursor-pointer text-[var(--berry)] hover:text-[var(--orange)]"
                href="https://github.com/711web/referral-platform"
              >
                GitHub
              </a>
              <Link className="cursor-pointer text-[var(--berry)] hover:text-[var(--orange)]" href="/go/demo" prefetch={false}>
                See a redirect
              </Link>
            </nav>
          </div>
          <div className="flex flex-col justify-between gap-3 border-t border-dotted border-[var(--rule)] pt-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--berry-2)] sm:flex-row">
            <span>{today} · London · doc 0001</span>
            <span>Built this week. Live now. Free during build-out.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
