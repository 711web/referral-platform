import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getWorkspaceForUser } from '@/lib/workspaces/queries';
import { getStripe, stripeAvailable, findCreditPack } from '@/lib/stripe/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const ws = await getWorkspaceForUser(session.user.id);
  if (!ws) {
    return NextResponse.json({ error: 'no workspace' }, { status: 404 });
  }
  if (!stripeAvailable()) {
    return NextResponse.json(
      { error: 'Credit purchase is not yet enabled (missing STRIPE_SECRET_KEY)' },
      { status: 503 },
    );
  }
  const form = await req.formData();
  const packId = String(form.get('packId') ?? '');
  const pack = findCreditPack(packId);
  if (!pack) {
    return NextResponse.json({ error: 'unknown pack' }, { status: 400 });
  }

  const stripe = getStripe();
  const origin = req.headers.get('origin') ?? `https://${req.headers.get('host') ?? 'partner.711web.com'}`;
  const sess = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: pack.amountCents,
          product_data: {
            name: `Partner — ${pack.name}`,
            description: `${pack.credits} AI credits for partner.711web.com`,
          },
        },
      },
    ],
    success_url: `${origin}/app/credits?ok=1`,
    cancel_url: `${origin}/app/credits?cancelled=1`,
    metadata: {
      workspace_id: ws.id,
      pack_id: pack.id,
      credits: String(pack.credits),
    },
  });

  return NextResponse.redirect(sess.url!, { status: 303 });
}
