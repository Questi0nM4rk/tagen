import type { CardId } from "../lib/types.ts";

/**
 * The distinct lowercased tokens of a search query — the unit of ranking.
 * Raw CLI terms are whitespace-split, lowercased, and deduped once here so
 * every downstream consumer sees the same token set.
 */
export class SearchQuery {
  readonly tokens: readonly string[];

  constructor(terms: readonly string[]) {
    const tokens = [
      ...new Set(
        terms.flatMap((term) => term.toLowerCase().split(/\s+/)).filter((t) => t !== "")
      ),
    ];
    if (tokens.length === 0) {
      throw new Error("search query must contain at least one token");
    }
    this.tokens = Object.freeze(tokens);
    Object.freeze(this);
  }
}

/** Match count for one card-relative file (`CORE.md` or `references/*.md`). */
export interface FileMatches {
  readonly path: string;
  readonly matches: number;
}

/** One card's aggregated search hits, ready for ranking and output. */
export interface CardSearchResult {
  readonly id: CardId;
  /** Distinct query tokens with at least one hit in this card. */
  readonly tokensMatched: number;
  /** Distinct tokens in the query. */
  readonly tokensTotal: number;
  /** Total word hits across all tokens and files. */
  readonly matches: number;
  /** Files with ≥1 hit, most hits first (path asc on ties). */
  readonly files: readonly FileMatches[];
}
