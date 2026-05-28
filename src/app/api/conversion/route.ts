import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { workspaces } from '@/db/schema';
import { recordConversion } from '@/lib/conversions/record';
import { verifyHmac } from '@/lib/conversions/hmac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = '_clid';

type Payload = {
  click_id?: string;
  amount?: number; // dollars, e.g. 49.00
  amount_cents?: number;
  currency?: string;
  order_id?: string;
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Brand-Key, X-Signature',
    'Access-Control-Max-Age': '86400',
  };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders();

  // Read raw body so we can HMAC-verify it
  const rawBody = await req.text();
  let body: Payload;
  try {
    body = rawBody ? (JSON.parse(rawBody) as Payload) : {};
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400, headers });
  }

  const brandKey = req.headers.get('x-brand-key');
  const signature = req.headers.get('x-signature');

  // 1. Identify brand workspace
  let brandWorkspaceId: string | null = null;
  let source: 'webhook' | 'pixel' = 'pixel';

  if (!brandKey) {
    return NextResponse.json({ error: 'X-Brand-Key required' }, { status: 400, headers });
  }
  const [brand] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.brandKey, brandKey))
    .limit(1);
  if (!brand) {
    return NextResponse.json({ error: 'unknown brand key' }, { status: 401, headers });
  }
  brandWorkspaceId = brand.id;

  // Signed path = high trust. Unsigned = pixel-class trust.
  if (signature) {
    source = 'webhook';
    if (!brand.brandSecret || !verifyHmac(brand.brandSecret, rawBody, signature)) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401, headers });
    }
  } else {
    source = 'pixel';
  }

  // 2. Resolve click_id (from body OR cookie)
  const clickId =
    body.click_id ?? req.cookies.get(COOKIE_NAME)?.value ?? null;
  if (!clickId) {
    return NextResponse.json({ error: 'click_id required' }, { status: 400, headers });
  }

  // 3. Compute amount in cents
  let amountCents = 0;
  if (typeof body.amount_cents === 'number') {
    amountCents = Math.max(0, Math.floor(body.amount_cents));
  } else if (typeof body.amount === 'number') {
    amountCents = Math.max(0, Math.floor(body.amount * 100));
  }

  const result = await recordConversion({
    clickIdCookie: clickId,
    brandWorkspaceId,
    amountCents,
    currency: body.currency ?? 'USD',
    externalOrderId: body.order_id ?? null,
    source,
  });

  return NextResponse.json(
    {
      conversion_id: result.conversion.id,
      commission_id: result.commission?.id ?? null,
      status: result.conversion.status,
      duplicate: result.duplicate,
    },
    { status: result.duplicate ? 200 : 201, headers },
  );
}
