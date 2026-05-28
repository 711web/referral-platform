import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { workspaces, creditPacks, aiUsage } from '@/db/schema';

export async function getCredits(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ ai_credits: workspaces.aiCredits })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return row?.ai_credits ?? 0;
}

/**
 * Atomically decrement credits and write a usage row. Returns false if
 * insufficient balance (no charge taken).
 */
export async function chargeCredits(
  workspaceId: string,
  cost: number,
  meta: {
    feature: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
  },
): Promise<{ ok: boolean; remaining: number }> {
  return await db.transaction(async (tx) => {
    // Conditional decrement: only if balance >= cost
    const updated = await tx
      .update(workspaces)
      .set({ aiCredits: sql`${workspaces.aiCredits} - ${cost}` })
      .where(
        sql`${workspaces.id} = ${workspaceId} AND ${workspaces.aiCredits} >= ${cost}`,
      )
      .returning({ remaining: workspaces.aiCredits });

    if (updated.length === 0) {
      // Look up current balance for error message
      const [ws] = await tx
        .select({ ai_credits: workspaces.aiCredits })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);
      return { ok: false, remaining: ws?.ai_credits ?? 0 };
    }

    await tx.insert(aiUsage).values({
      workspaceId,
      feature: meta.feature,
      model: meta.model,
      inputTokens: meta.inputTokens ?? 0,
      outputTokens: meta.outputTokens ?? 0,
      creditCost: cost,
    });

    return { ok: true, remaining: updated[0]!.remaining };
  });
}

export async function grantCredits(
  workspaceId: string,
  credits: number,
  pack: { amountCents: number; currency?: string; stripeSessionId?: string; stripeInvoiceId?: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(creditPacks).values({
      workspaceId,
      credits,
      amountCents: pack.amountCents,
      currency: pack.currency ?? 'USD',
      stripeSessionId: pack.stripeSessionId,
      stripeInvoiceId: pack.stripeInvoiceId,
    });
    await tx
      .update(workspaces)
      .set({ aiCredits: sql`${workspaces.aiCredits} + ${credits}` })
      .where(eq(workspaces.id, workspaceId));
  });
}
