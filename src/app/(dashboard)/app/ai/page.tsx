import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser } from '@/lib/workspaces/queries';
import { getCredits } from '@/lib/credits/queries';
import { AiPanels } from './ai-panels';

export const dynamic = 'force-dynamic';

export default async function AiAssistantPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) redirect('/login');
  const balance = await getCredits(ws.id);
  const aiEnabled = Boolean(process.env.OPENROUTER_API_KEY);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI assistant</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Generate campaign briefs, captions, and pitch DMs.
          </p>
        </div>
        <Link href="/app/credits" className="text-sm underline-offset-4 hover:underline">
          <span className="font-mono tnum">{balance.toLocaleString()}</span> credits
        </Link>
      </header>
      {!aiEnabled && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          AI is not yet enabled on this deployment (missing OPENROUTER_API_KEY). Forms below
          return a 503; they&apos;ll work the moment the key is in <code>.env</code>.
        </div>
      )}
      <AiPanels />
    </div>
  );
}
