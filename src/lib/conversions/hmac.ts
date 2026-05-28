import crypto from 'crypto';

/** Constant-time HMAC verification (sha256). */
export function verifyHmac(secret: string, payload: string, signatureHex: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signatureHex, 'hex');
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function generateBrandKey(): string {
  return 'pk_' + crypto.randomBytes(16).toString('hex');
}

export function generateBrandSecret(): string {
  return 'whsec_' + crypto.randomBytes(32).toString('hex');
}
