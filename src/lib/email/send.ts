/**
 * Lightweight email wrapper around Resend. Returns { ok:false, reason:'disabled' }
 * if RESEND_API_KEY isn't set so callers can no-op gracefully.
 */

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'disabled' | string };

const FROM_DEFAULT = process.env.RESEND_FROM ?? 'Partner <hello@partner.711web.com>';

export function emailAvailable(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}): Promise<SendResult> {
  if (!emailAvailable()) return { ok: false, reason: 'disabled' };
  const apiKey = process.env.RESEND_API_KEY!;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: args.from ?? FROM_DEFAULT,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return { ok: false, reason: `${res.status}: ${t.slice(0, 160)}` };
  }
  const data = (await res.json()) as { id?: string };
  return { ok: true, id: data.id ?? '' };
}
