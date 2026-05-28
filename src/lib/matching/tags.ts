/**
 * Jaccard similarity between two comma-separated tag strings.
 * 1.0 = identical sets, 0 = no overlap.
 */
export function jaccard(a: string, b: string): number {
  const A = tagSet(a);
  const B = tagSet(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const tag of A) if (B.has(tag)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function tagSet(s: string): Set<string> {
  return new Set(
    s
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function rankCampaignsForCreator<T extends { tags: string }>(
  creatorTags: string,
  campaigns: T[],
): Array<T & { score: number }> {
  return campaigns
    .map((c) => ({ ...c, score: jaccard(creatorTags, c.tags) }))
    .sort((x, y) => y.score - x.score);
}
