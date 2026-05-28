import Stripe from 'stripe';

export function stripeAvailable(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  if (!cached) {
    cached = new Stripe(key);
  }
  return cached;
}

export const CREDIT_PACKS = [
  { id: 'small', credits: 100, amountCents: 500, name: '100 credits' },
  { id: 'medium', credits: 500, amountCents: 2000, name: '500 credits' },
  { id: 'large', credits: 2000, amountCents: 6000, name: '2000 credits' },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]['id'];

export function findCreditPack(id: string) {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}
