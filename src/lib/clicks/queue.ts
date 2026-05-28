import { db } from '@/db/client';
import { clicks, type NewClick } from '@/db/schema';

let buffer: NewClick[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL_MS = 2000;
const MAX_BUFFER = 500;

export type EnqueueInput = {
  linkId: string;
  clickIdCookie: string;
  userAgent?: string | null;
  referrer?: string | null;
  country?: string | null;
  device?: string | null;
  ipHash?: string | null;
};

export function enqueueClick(input: EnqueueInput): void {
  buffer.push({
    linkId: input.linkId,
    clickIdCookie: input.clickIdCookie,
    userAgent: input.userAgent ?? null,
    referrer: input.referrer ?? null,
    country: input.country ?? null,
    device: input.device ?? null,
    ipHash: input.ipHash ?? null,
  });
  if (buffer.length >= MAX_BUFFER) {
    void flushClicks();
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      void flushClicks();
    }, FLUSH_INTERVAL_MS);
  }
}

export async function flushClicks(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  try {
    await db.insert(clicks).values(batch);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[clicks-queue] flush failed; dropping batch', e);
  }
}

export function _resetQueue(): void {
  buffer = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
