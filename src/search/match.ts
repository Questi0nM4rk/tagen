import { levenshtein } from "../lib/fuzzy.ts";

/**
 * Tokens shorter than this match by substring only — edit distance on tiny
 * tokens is all noise ("tdd" would match every 3-letter word one edit away).
 */
export const MIN_EDIT_DISTANCE_TOKEN_LENGTH = 4;

/**
 * Lowercased words of a document body. Splits on anything outside
 * [a-z0-9_-] so hyphenated/underscored identifiers stay whole words.
 */
export function textWords(text: string): readonly string[] {
  return Object.freeze(
    text
      .toLowerCase()
      .split(/[^a-z0-9_-]+/)
      .filter((word) => word !== "")
  );
}

/**
 * A document word matches a query token when the token is a substring of the
 * word, or (for tokens of length ≥ 4) the whole word is within Levenshtein
 * distance 1 of the token. Both sides must already be lowercased.
 */
export function wordMatchesToken(word: string, token: string): boolean {
  if (word.includes(token)) return true;
  if (token.length < MIN_EDIT_DISTANCE_TOKEN_LENGTH) return false;
  if (Math.abs(word.length - token.length) > 1) return false;
  return levenshtein(word, token) <= 1;
}

/** How many of the document's words match the token. */
export function countTokenMatches(words: readonly string[], token: string): number {
  let count = 0;
  for (const word of words) {
    if (wordMatchesToken(word, token)) count++;
  }
  return count;
}
