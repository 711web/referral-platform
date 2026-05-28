'use client';

import { useActionState } from 'react';
import {
  generateBriefAction,
  generatePostCopyAction,
  generatePitchAction,
  type AiResultState,
} from './actions';

const initial: AiResultState = {};

function ResultBlock({ state }: { state: AiResultState }) {
  if (state.error) {
    return (
      <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.text) {
    return (
      <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--border)] bg-slate-50 p-4 font-mono text-[13px] leading-[1.55]">
        {state.text}
      </pre>
    );
  }
  return null;
}

function Footer({ state }: { state: AiResultState }) {
  if (state.creditsRemaining === undefined) return null;
  return (
    <p className="mt-2 text-xs text-[var(--muted)]">
      remaining credits: <span className="font-mono tnum">{state.creditsRemaining}</span>
    </p>
  );
}

export function AiPanels() {
  const [briefState, briefAction, briefPending] = useActionState(generateBriefAction, initial);
  const [postState, postAction, postPending] = useActionState(generatePostCopyAction, initial);
  const [pitchState, pitchAction, pitchPending] = useActionState(generatePitchAction, initial);

  const fieldCls = 'rounded-md border border-[var(--border)] px-3 py-2 text-sm';
  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-[var(--border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Campaign brief generator</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Costs 2 credits.</p>
        <form action={briefAction} className="mt-4 flex flex-col gap-3">
          <input name="campaignName" required placeholder="Campaign name" className={fieldCls} />
          <input
            name="landingUrl"
            type="url"
            required
            placeholder="https://yourbrand.com/landing"
            className={fieldCls}
          />
          <input name="tags" placeholder="tags (comma-separated)" className={fieldCls} />
          <button
            type="submit"
            disabled={briefPending}
            className="cursor-pointer self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {briefPending ? 'Generating…' : 'Generate brief'}
          </button>
        </form>
        <ResultBlock state={briefState} />
        <Footer state={briefState} />
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Caption / post copy</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Costs 1 credit per platform.</p>
        <form action={postAction} className="mt-4 flex flex-col gap-3">
          <select name="platform" defaultValue="instagram" className={fieldCls}>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="x">X (Twitter)</option>
            <option value="youtube">YouTube</option>
          </select>
          <input name="campaignName" required placeholder="Campaign name" className={fieldCls} />
          <textarea
            name="brief"
            rows={3}
            placeholder="Brief / context (optional)"
            className={fieldCls}
          />
          <button
            type="submit"
            disabled={postPending}
            className="cursor-pointer self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {postPending ? 'Writing…' : 'Generate caption'}
          </button>
        </form>
        <ResultBlock state={postState} />
        <Footer state={postState} />
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Pitch DM</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Costs 1 credit.</p>
        <form action={pitchAction} className="mt-4 flex flex-col gap-3">
          <input
            name="creatorHandle"
            required
            placeholder="creator handle (no @)"
            className={fieldCls}
          />
          <input name="campaignName" required placeholder="Campaign name" className={fieldCls} />
          <textarea name="brief" rows={3} placeholder="What you'd say" className={fieldCls} />
          <button
            type="submit"
            disabled={pitchPending}
            className="cursor-pointer self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pitchPending ? 'Drafting…' : 'Draft pitch'}
          </button>
        </form>
        <ResultBlock state={pitchState} />
        <Footer state={pitchState} />
      </section>
    </div>
  );
}
