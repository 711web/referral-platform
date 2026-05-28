import { NextResponse } from 'next/server';
import { desc, eq, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { commissions, conversions, workspaces } from '@/db/schema';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser } from '@/lib/workspaces/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) {
    return NextResponse.json({ error: 'no workspace' }, { status: 404 });
  }

  const rows = await db
    .select({
      commission: commissions,
      conversion: conversions,
      creator: workspaces,
    })
    .from(commissions)
    .innerJoin(conversions, eq(conversions.id, commissions.conversionId))
    .innerJoin(workspaces, eq(workspaces.id, commissions.creatorWorkspaceId))
    .where(
      or(
        eq(commissions.brandWorkspaceId, ws.id),
        eq(commissions.creatorWorkspaceId, ws.id),
      ),
    )
    .orderBy(desc(commissions.createdAt));

  const header = [
    'created_at',
    'commission_id',
    'conversion_id',
    'role',
    'counterparty_name',
    'creator_workspace_id',
    'brand_workspace_id',
    'amount_cents',
    'currency',
    'status',
    'conversion_amount_cents',
    'external_order_id',
  ];

  const lines = [header.join(',')];
  for (const r of rows) {
    const role = r.commission.brandWorkspaceId === ws.id ? 'brand' : 'creator';
    lines.push(
      [
        r.commission.createdAt.toISOString(),
        r.commission.id,
        r.commission.conversionId,
        role,
        r.creator.name,
        r.commission.creatorWorkspaceId,
        r.commission.brandWorkspaceId,
        r.commission.amountCents,
        r.commission.currency,
        r.commission.status,
        r.conversion.amountCents,
        r.conversion.externalOrderId,
      ]
        .map(escape)
        .join(','),
    );
  }

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="partner-payouts-${ws.id.slice(0, 8)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
