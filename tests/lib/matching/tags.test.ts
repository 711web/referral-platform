import { describe, it, expect } from 'vitest';
import { jaccard, rankCampaignsForCreator } from '@/lib/matching/tags';

describe('jaccard', () => {
  it('returns 1 for identical sets', () => {
    expect(jaccard('beauty, skincare', 'skincare, beauty')).toBe(1);
  });
  it('returns 0 for fully disjoint sets', () => {
    expect(jaccard('beauty', 'crypto')).toBe(0);
  });
  it('returns 0.5 for half overlap', () => {
    // {a,b} vs {b,c} → |inter|=1, |union|=3 → 1/3
    expect(jaccard('a,b', 'b,c')).toBeCloseTo(1 / 3, 5);
  });
  it('treats empty sets as 0', () => {
    expect(jaccard('', '')).toBe(0);
    expect(jaccard('beauty', '')).toBe(0);
  });
});

describe('rankCampaignsForCreator', () => {
  it('sorts campaigns by similarity desc', () => {
    const ranked = rankCampaignsForCreator('beauty, fashion, summer', [
      { id: '1', tags: 'crypto, defi' },
      { id: '2', tags: 'beauty, makeup, summer' },
      { id: '3', tags: 'beauty' },
    ]);
    expect(ranked[0]!.id).toBe('2');
    expect(ranked[1]!.id).toBe('3');
    expect(ranked[2]!.id).toBe('1');
    expect(ranked[2]!.score).toBe(0);
  });
});
