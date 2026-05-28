import { NextRequest, NextResponse } from 'next/server';
import { lookupLinkBySlug } from '@/lib/links/lookup';
import { enqueueClick } from '@/lib/clicks/queue';
import { newClickId } from '@/lib/ids';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = '_clid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

function parseDevice(ua: string | null): string | null {
  if (!ua) return null;
  if (/iPhone|Android.*Mobile|Mobile/.test(ua)) return 'mobile';
  if (/iPad|Tablet/.test(ua)) return 'tablet';
  return 'desktop';
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const link = await lookupLinkBySlug(slug);
  if (!link) {
    return new NextResponse('Not found', { status: 404 });
  }

  const existing = req.cookies.get(COOKIE_NAME)?.value;
  const clickId = existing ?? newClickId();

  const ua = req.headers.get('user-agent');
  const country = req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry');
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip');

  enqueueClick({
    linkId: link.id,
    clickIdCookie: clickId,
    userAgent: ua,
    referrer: req.headers.get('referer'),
    country: country ?? null,
    device: parseDevice(ua),
    ipHash: hashIp(ip ?? null),
  });

  const dest = new URL(link.destinationUrl);
  dest.searchParams.set('utm_source', process.env.SHORT_DOMAIN ?? 'partner.711web.com');
  dest.searchParams.set('utm_campaign', slug);

  const res = NextResponse.redirect(dest.toString(), 302);
  res.cookies.set(COOKIE_NAME, clickId, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false, // pixel needs to read it later (slice 3)
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
