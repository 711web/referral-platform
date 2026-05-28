'use client';

import { useEffect, useState } from 'react';

type Row = {
  t: string;
  tag: string;
  head: string;
  body: string;
  meta: string;
  accent?: boolean;
};

const SEQUENCE: Row[] = [
  { t: '14:03:01', tag: 'IN', head: '/go/summer-sale', body: 'click · London', meta: '+1' },
  { t: '14:03:01', tag: 'CK', head: 'cookie set', body: '_clid=01H2VKZ…RVA', meta: '30d' },
  { t: '14:03:01', tag: 'RD', head: '302 → example.com/landing', body: 'utm appended', meta: '76ms' },
  { t: '14:03:03', tag: 'DB', head: 'click logged', body: 'postgres · async batch', meta: '1 row' },
  { t: '14:03:14', tag: 'IN', head: '/go/docs', body: 'click · Mumbai', meta: '+1' },
  { t: '14:03:14', tag: 'CK', head: 'cookie set', body: '_clid=01H2VL3…7XK', meta: '30d' },
  { t: '14:03:14', tag: 'RD', head: '302 → docs.example.com', body: 'utm appended', meta: '84ms' },
  { t: '14:03:22', tag: 'CV', head: 'conversion fired', body: '/api/conversion', meta: '$24.00', accent: true },
  { t: '14:03:22', tag: 'CM', head: 'commission accrued', body: '→ @rizwan', meta: '+$2.40', accent: true },
  { t: '14:03:30', tag: 'IN', head: '/go/pricing', body: 'click · Berlin', meta: '+1' },
  { t: '14:03:30', tag: 'RD', head: '302 → example.com/pricing', body: 'utm appended', meta: '71ms' },
];

const VISIBLE = 7;

export function LiveLedger() {
  const [head, setHead] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setHead((h) => (h + 1) % SEQUENCE.length);
    }, 1700);
    return () => clearInterval(id);
  }, []);

  const shown: Array<Row & { _k: number }> = [];
  for (let i = 0; i < VISIBLE; i++) {
    const idx = (head + i) % SEQUENCE.length;
    const row = SEQUENCE[idx]!;
    shown.push({ ...row, _k: head * 1000 + i });
  }

  return (
    <div className="relative mx-auto w-full max-w-[440px] mono text-[12px] text-[var(--ink)]">
      {/* Stamp on corner */}
      <div className="absolute -right-3 -top-4 z-10 stamp">
        Demo · ledger
      </div>

      <div className="border border-[var(--ink)] bg-[var(--paper-2)] shadow-[6px_6px_0_var(--ink)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dashed border-[var(--ink)] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="block size-2 rounded-full bg-[var(--rouge)] [box-shadow:0_0_0_2px_var(--paper-2)]" />
            <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-2)]">
              Live · what one click triggers
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-2)]">
            sample
          </span>
        </div>

        {/* Column header */}
        <div className="grid grid-cols-[60px_44px_1fr_72px] gap-3 border-b border-[var(--rule)] px-5 py-2 text-[9px] uppercase tracking-[0.22em] text-[var(--ink-3)]">
          <span>Time</span>
          <span>Type</span>
          <span>Event</span>
          <span className="text-right">Note</span>
        </div>

        {/* Rows */}
        <ol className="px-5 py-3">
          {shown.map((r, i) => (
            <li
              key={`${r._k}-${i}`}
              className="row-in grid grid-cols-[60px_44px_1fr_72px] items-baseline gap-3 border-b border-dotted border-[var(--rule)] py-2 last:border-b-0"
              style={{
                animationDelay: `${i * 0.04}s`,
                opacity: Math.max(0.4, 1 - i * 0.085),
              }}
            >
              <span className="tnum text-[var(--ink-2)]">{r.t}</span>
              <span
                className={r.accent ? 'text-[var(--rouge)]' : 'text-[var(--ink-2)]'}
              >
                [{r.tag}]
              </span>
              <span className="min-w-0 truncate">
                <span className={r.accent ? 'text-[var(--rouge)]' : 'text-[var(--ink)]'}>
                  {r.head}
                </span>{' '}
                <span className="text-[var(--ink-2)]">· {r.body}</span>
              </span>
              <span
                className={`tnum text-right ${
                  r.accent ? 'text-[var(--rouge)]' : 'text-[var(--ink-2)]'
                }`}
              >
                {r.meta}
              </span>
            </li>
          ))}
        </ol>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-dashed border-[var(--ink)] px-5 py-3 text-[10px] uppercase tracking-[0.22em]">
          <span className="text-[var(--ink-2)]">Events · {SEQUENCE.length}</span>
          <span className="flex items-center gap-2 text-[var(--ink-2)]">
            <span className="block size-1.5 rounded-full bg-emerald-700" />
            dev cluster
          </span>
        </div>
      </div>

      {/* Torn edge */}
      <span className="torn-edge" aria-hidden="true" />
    </div>
  );
}
