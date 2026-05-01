import type { CardId } from "./types.ts";

export const MIN_QUERY_LENGTH = 3;

export interface FuzzyCandidate {
  id: CardId;
  /** Either the canonical name or one of its aliases. */
  matchedOn: string;
}

/** Search-space entry: every card name + every alias on every card. */
export interface FuzzyEntry {
  id: CardId;
  /** Canonical name + every alias, lowercased once for matching. */
  haystacks: string[];
}

/**
 * Match `query` against the entries. Tier order: exact > prefix > substring >
 * Levenshtein within distance 2. The first non-empty tier wins; ties WITHIN a
 * tier surface as multiple candidates (caller decides ambiguity policy).
 */
export function fuzzyMatch(entries: FuzzyEntry[], query: string): FuzzyCandidate[] {
  if (query.length < MIN_QUERY_LENGTH) return [];
  const q = query.toLowerCase();

  const exact: FuzzyCandidate[] = [];
  const prefix: FuzzyCandidate[] = [];
  const substring: FuzzyCandidate[] = [];
  const lev: Array<FuzzyCandidate & { dist: number }> = [];

  for (const entry of entries) {
    let best: { tier: 0 | 1 | 2 | 3; haystack: string; dist: number } | undefined;
    for (const h of entry.haystacks) {
      let candidateTier: 0 | 1 | 2 | 3;
      let dist = 0;
      if (h === q) {
        candidateTier = 0;
      } else if (h.startsWith(q)) {
        candidateTier = 1;
      } else if (h.includes(q)) {
        candidateTier = 2;
      } else {
        const d = levenshtein(h, q);
        if (d > 2) continue;
        candidateTier = 3;
        dist = d;
      }
      if (!best || candidateTier < best.tier || dist < best.dist) {
        best = { tier: candidateTier, haystack: h, dist };
      }
    }
    if (!best) continue;
    const cand = { id: entry.id, matchedOn: best.haystack };
    switch (best.tier) {
      case 0:
        exact.push(cand);
        break;
      case 1:
        prefix.push(cand);
        break;
      case 2:
        substring.push(cand);
        break;
      case 3:
        lev.push({ ...cand, dist: best.dist });
        break;
    }
  }

  if (exact.length > 0) return exact;
  if (prefix.length > 0) return prefix;
  if (substring.length > 0) return substring;
  if (lev.length === 0) return [];
  const minDist = Math.min(...lev.map((c) => c.dist));
  return lev
    .filter((c) => c.dist === minDist)
    .map(({ id, matchedOn }) => ({ id, matchedOn }));
}

/** Standard iterative Levenshtein. Used only for tier-3 fallback. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n] ?? 0;
}
