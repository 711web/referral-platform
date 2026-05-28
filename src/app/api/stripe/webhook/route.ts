import { NextRequest, NextResponse } from 'next/server';
import { getStripe, stripeAvailable } from '@/lib/stripe/client';
import { grantCredits } from '@/lib/credits/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!stripeAvailable()) {
    return NextResponse.json({ error: 'stripe disabled' }, { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET not set' }, { status: 500 });
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'missing stripe-signature' }, { status: 400 });
  }
  const rawBody = await req.text();
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'invalid signature';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const sess = event.data.object as {
      id: string;
      amount_total: number | null;
      currency: string | null;
      payment_status: string;
      metadata: Record<string, string> | null;
    };
    if (sess.payment_status !== 'paid') {
      return NextResponse.json({ received: true, skipped: 'not paid' });
    }
    const workspaceId = sess.metadata?.workspace_id;
    const credits = Number(sess.metadata?.credits ?? 0);
    if (!workspaceId || !credits) {
      return NextResponse.json({ received: true, skipped: 'missing metadata' });
    }
    try {
      await grantCredits(workspaceId, credits, {
        amountCents: sess.amount_total ?? 0,
        currency: (sess.currency ?? 'usd').toUpperCase(),
        stripeSessionId: sess.id,
      });
    } catch (e) {
      // unique constraint on stripe_session_id ⇒ already processed
      // eslint-disable-next-line no-console
      console.warn('[stripe-webhook] grant skipped:', (e as Error).message);
    }
  }

  return NextResponse.json({ received: true });
}
