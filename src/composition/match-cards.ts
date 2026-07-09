import { findAliasCollisions } from "../lib/aliases.ts";
import { type FuzzyEntry, fuzzyMatch, MIN_QUERY_LENGTH } from "../lib/fuzzy.ts";
import { type Card, type CardType, cardIndex, cardKey } from "../lib/types.ts";
import type { ComposeQuery } from "./contracts.ts";

export interface CardMatch {
  readonly cards: readonly Card[];
  readonly errors: readonly string[];
  readonly browseTypes: readonly CardType[];
  readonly emptyMatch: boolean;
}

/**
 * Match cards against a compose query using explicit IDs and fuzzy positional
 * args. Returns matched cards, errors, browse-intent types, and empty-match flag.
 */
export function matchCards(
  cards: readonly Card[],
  query: ComposeQuery,
  knownTypes: ReadonlySet<CardType>
): CardMatch {
  const errors = [...findAliasCollisions(cards)];
  const browseTypes: CardType[] = [];
  const index = cardIndex(cards);
  const matched = new Map<string, Card>();

  matchExplicit(query, index, matched, errors);
  matchPositional(cards, query, knownTypes, index, matched, browseTypes, errors);

  return Object.freeze({
    cards: Object.freeze([...matched.values()]),
    errors: Object.freeze(errors),
    browseTypes: Object.freeze(browseTypes),
    emptyMatch: matched.size === 0 && browseTypes.length === 0,
  });
}

function matchExplicit(
  query: ComposeQuery,
  index: ReadonlyMap<string, Card>,
  matched: Map<string, Card>,
  errors: string[]
): void {
  for (const id of query.explicit) {
    const card = index.get(cardKey(id));
    if (!card) {
      errors.push(`unknown card: ${id.type}/${id.name}`);
      continue;
    }
    matched.set(cardKey(id), card);
  }
}

function matchPositional(
  cards: readonly Card[],
  query: ComposeQuery,
  knownTypes: ReadonlySet<CardType>,
  index: ReadonlyMap<string, Card>,
  matched: Map<string, Card>,
  browseTypes: CardType[],
  errors: string[]
): void {
  const fuzzyEntries = buildFuzzyEntries(cards);
  for (const argument of query.positional) {
    if (knownTypes.has(argument)) {
      browseTypes.push(argument);
      continue;
    }
    matchArgument(argument, fuzzyEntries, index, matched, errors);
  }
}

function matchArgument(
  argument: string,
  fuzzyEntries: readonly FuzzyEntry[],
  index: ReadonlyMap<string, Card>,
  matched: Map<string, Card>,
  errors: string[]
): void {
  if (argument.length < MIN_QUERY_LENGTH) {
    errors.push(
      `arg '${argument}' shorter than minimum ${MIN_QUERY_LENGTH} characters`
    );
    return;
  }
  const candidates = fuzzyMatch(fuzzyEntries, argument);
  if (candidates.length === 0) {
    errors.push(`no card matches arg: ${argument}`);
    return;
  }
  if (candidates.length > 1) {
    const choices = candidates
      .map((candidate) => cardKey(candidate.id))
      .sort()
      .join(", ");
    errors.push(`ambiguous arg '${argument}': matches ${choices}. Use --type/--name.`);
    return;
  }
  const candidate = candidates[0];
  if (!candidate) return;
  const card = index.get(cardKey(candidate.id));
  if (card) matched.set(cardKey(card.id), card);
}

function buildFuzzyEntries(cards: readonly Card[]): readonly FuzzyEntry[] {
  return cards.map((card) => ({
    id: card.id,
    haystacks: [
      card.id.name.toLowerCase(),
      ...(card.frontmatter.aliases ?? []).map((alias) => alias.toLowerCase()),
    ],
  }));
}
