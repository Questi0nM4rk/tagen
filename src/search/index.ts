/**
 * Full-text fuzzy search over card content.
 *
 * Searches every card body file (CORE.md + references/*.md, protocol cards
 * included), skipping frontmatter blocks. Results are grouped per card and
 * ranked by distinct query tokens matched, then total matches, then
 * type/name (deterministic).
 */
import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { CORE_FILE } from "../lib/catalog.ts";
import type { Card } from "../lib/types.ts";
import type { CardSearchResult, FileMatches, SearchQuery } from "./contracts.ts";
import { countTokenMatches, textWords } from "./match.ts";

export type { CardSearchResult, FileMatches } from "./contracts.ts";
export { SearchQuery } from "./contracts.ts";

const FRONTMATTER_BLOCK = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/;

/** Frontmatter is metadata, not prose — search body text only. */
function stripFrontmatter(source: string): string {
  return source.replace(FRONTMATTER_BLOCK, "");
}

/** One searchable body file of a card, addressed card-relative. */
interface CardDocument {
  readonly path: string;
  readonly text: string;
}

/** CORE.md (body already frontmatter-free) + every references/*.md. */
function cardDocuments(card: Card, root: string): readonly CardDocument[] {
  const documents: CardDocument[] = [{ path: CORE_FILE, text: card.body }];
  for (const reference of card.references) {
    const absPath = join(root, reference);
    documents.push({
      path: relative(card.dirPath, absPath).split(sep).join("/"),
      text: stripFrontmatter(readFileSync(absPath, "utf8")),
    });
  }
  return documents;
}

/** Score one card. Undefined when nothing in the card matches. */
function searchCard(
  card: Card,
  root: string,
  query: SearchQuery
): CardSearchResult | undefined {
  const matchedTokens = new Set<string>();
  const files: FileMatches[] = [];
  let total = 0;

  for (const document of cardDocuments(card, root)) {
    const words = textWords(document.text);
    let documentMatches = 0;
    for (const token of query.tokens) {
      const count = countTokenMatches(words, token);
      if (count > 0) matchedTokens.add(token);
      documentMatches += count;
    }
    if (documentMatches > 0) {
      files.push(Object.freeze({ path: document.path, matches: documentMatches }));
    }
    total += documentMatches;
  }

  if (total === 0) return undefined;
  files.sort((a, b) => b.matches - a.matches || a.path.localeCompare(b.path));
  return Object.freeze({
    id: card.id,
    tokensMatched: matchedTokens.size,
    tokensTotal: query.tokens.length,
    matches: total,
    files: Object.freeze(files),
  });
}

/**
 * Search every card, ranked: distinct tokens matched desc, total matches
 * desc, then type/name asc for determinism.
 */
export function searchCards(
  cards: readonly Card[],
  root: string,
  query: SearchQuery
): readonly CardSearchResult[] {
  const results: CardSearchResult[] = [];
  for (const card of cards) {
    const result = searchCard(card, root, query);
    if (result) results.push(result);
  }
  results.sort(
    (a, b) =>
      b.tokensMatched - a.tokensMatched ||
      b.matches - a.matches ||
      a.id.type.localeCompare(b.id.type) ||
      a.id.name.localeCompare(b.id.name)
  );
  return Object.freeze(results);
}
