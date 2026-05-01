import { rel } from "./catalog.ts";
import { type FuzzyEntry, fuzzyMatch, MIN_QUERY_LENGTH } from "./fuzzy.ts";
import {
  type Card,
  type CardId,
  type CardType,
  cardKey,
  type FilledSlot,
  type Manifest,
  type ResolvedSlot,
  SUBAGENT_HOST_TYPES,
} from "./types.ts";

export interface ComposeQuery {
  /** Free-form positional args fuzzy-matched to cards. */
  positional: string[];
  /** Explicit (type, name) selections, paired and repeatable. */
  explicit: CardId[];
  /** `--pin <type>=<name>` overrides for slot filling. */
  pins: Map<CardType, string>;
}

export interface ComposeOutcome {
  manifest?: Manifest;
  /** Errors that prevent producing a manifest (ambiguous fuzzy match, etc.). */
  errors: string[];
  /** Browse intent triggered: a positional arg matched a type dir name. */
  browseTypes: CardType[];
  /** Composition was attempted but no cards matched (exit-2 case). */
  emptyMatch: boolean;
}

export function emptyQuery(): ComposeQuery {
  return { positional: [], explicit: [], pins: new Map() };
}

/**
 * Resolve a query into a manifest per SPEC-tagen "Resolution algorithm".
 *
 * `cards` is the full catalog. `root` is the marketplace dir (parent of brain/).
 * `knownTypes` is every dir name under brain/ — used both for slot validation
 * and for browse-intent detection on bare type-name positional args.
 */
export function compose(
  cards: Card[],
  root: string,
  query: ComposeQuery,
  knownTypes: Set<CardType>
): ComposeOutcome {
  const errors: string[] = [];
  const warnings: string[] = [];
  const browseTypes: CardType[] = [];

  const index = new Map<string, Card>();
  for (const c of cards) index.set(cardKey(c.id), c);

  buildAliasIndex(cards, errors);

  const matched = new Map<string, Card>();

  for (const id of query.explicit) {
    const card = index.get(cardKey(id));
    if (!card) {
      errors.push(`unknown card: ${id.type}/${id.name}`);
      continue;
    }
    matched.set(cardKey(id), card);
  }

  const fuzzyEntries = buildFuzzyEntries(cards);
  for (const arg of query.positional) {
    if (knownTypes.has(arg)) {
      browseTypes.push(arg);
      continue;
    }
    if (arg.length < MIN_QUERY_LENGTH) {
      errors.push(`arg '${arg}' shorter than minimum ${MIN_QUERY_LENGTH} characters`);
      continue;
    }
    const candidates = fuzzyMatch(fuzzyEntries, arg);
    if (candidates.length === 0) {
      errors.push(`no card matches arg: ${arg}`);
      continue;
    }
    if (candidates.length > 1) {
      const list = candidates
        .map((c) => cardKey(c.id))
        .sort()
        .join(", ");
      errors.push(`ambiguous arg '${arg}': matches ${list}. Use --type/--name.`);
      continue;
    }
    const onlyCandidate = candidates[0];
    if (!onlyCandidate) continue;
    const card = index.get(cardKey(onlyCandidate.id));
    if (card) matched.set(cardKey(card.id), card);
  }

  if (errors.length > 0) {
    return { errors, browseTypes, emptyMatch: false };
  }

  if (matched.size === 0 && browseTypes.length === 0) {
    return { errors: [], browseTypes, emptyMatch: true };
  }

  if (matched.size === 0 && browseTypes.length > 0) {
    return { errors: [], browseTypes, emptyMatch: false };
  }

  const matchedSorted = [...matched.values()].sort(byTypeName);

  const requiredTypes = collectRequires(matchedSorted);
  const slots: ResolvedSlot[] = [];
  const filled: Record<CardType, FilledSlot> = {};
  const fillerKeys = new Set<string>();

  for (const reqType of requiredTypes) {
    const candidates = matchedSorted
      .filter((c) => c.id.type === reqType)
      .sort(byTypeName);
    const candidateNames = candidates.map((c) => c.id.name);

    let chosen: Card | undefined;
    const pin = query.pins.get(reqType);
    if (pin) {
      chosen = candidates.find((c) => c.id.name === pin);
      if (!chosen) {
        warnings.push(
          `--pin ${reqType}=${pin} did not match any candidate (have: ${candidateNames.join(", ") || "none"})`
        );
      }
    }
    if (!chosen) chosen = candidates[0];

    if (!chosen) {
      warnings.push(`unfilled slot for type ${reqType}`);
      slots.push({ type: reqType, fillerCard: "", candidates: candidateNames });
      continue;
    }

    if (candidates.length > 1) {
      warnings.push(
        `multiple candidates for type ${reqType}: ${candidateNames.join(", ")}. Picked ${chosen.id.name}. Use --pin ${reqType}=<name> to override.`
      );
    }

    slots.push({
      type: reqType,
      fillerCard: chosen.id.name,
      candidates: candidateNames,
    });
    filled[reqType] = {
      core: rel(chosen.corePath, root),
      references: chosen.references,
    };
    fillerKeys.add(cardKey(chosen.id));
  }

  const subagents = resolveSubagents(matchedSorted, index, root, warnings);
  const validators = matchedSorted
    .filter((c) => c.id.type === "review" || c.id.type === "methodology")
    .flatMap((c) => c.validators);

  const nonFillers = matchedSorted.filter((c) => !fillerKeys.has(cardKey(c.id)));

  const manifest: Manifest = {
    root,
    modules: matchedSorted.map((c) => ({
      type: c.id.type,
      name: c.id.name,
      core: rel(c.corePath, root),
    })),
    core: nonFillers.map((c) => rel(c.corePath, root)),
    references: nonFillers.flatMap((c) => c.references),
    filled,
    slots,
    subagents,
    validators,
    warnings,
  };

  return { manifest, errors: [], browseTypes, emptyMatch: false };
}

function buildAliasIndex(cards: Card[], errors: string[]): Map<string, CardId> {
  const aliases = new Map<string, CardId>();
  const cardsByName = new Map<string, CardId>();
  for (const c of cards) cardsByName.set(c.id.name, c.id);

  for (const c of cards) {
    for (const alias of c.frontmatter.aliases ?? []) {
      const collidingCanonical = cardsByName.get(alias);
      if (collidingCanonical) {
        errors.push(
          `alias '${alias}' on ${cardKey(c.id)} collides with canonical name ${cardKey(collidingCanonical)}`
        );
      }
      const existing = aliases.get(alias);
      if (existing) {
        errors.push(
          `alias '${alias}' collides between ${cardKey(existing)} and ${cardKey(c.id)}`
        );
        continue;
      }
      aliases.set(alias, c.id);
    }
  }
  return aliases;
}

function buildFuzzyEntries(cards: Card[]): FuzzyEntry[] {
  return cards.map((c) => ({
    id: c.id,
    haystacks: [
      c.id.name.toLowerCase(),
      ...(c.frontmatter.aliases ?? []).map((a) => a.toLowerCase()),
    ],
  }));
}

function collectRequires(cards: Card[]): CardType[] {
  const seen = new Set<CardType>();
  for (const c of cards) {
    for (const r of c.frontmatter.requires ?? []) seen.add(r);
  }
  return [...seen].sort();
}

function resolveSubagents(
  cards: Card[],
  index: Map<string, Card>,
  root: string,
  warnings: string[]
): string[] {
  const out = new Set<string>();
  for (const c of cards) {
    if (!SUBAGENT_HOST_TYPES.has(c.id.type)) continue;
    for (const name of c.frontmatter.subagents ?? []) {
      const sub = index.get(cardKey({ type: "subagent", name }));
      if (!sub) {
        warnings.push(`unknown subagent: ${name} referenced by ${cardKey(c.id)}`);
        continue;
      }
      out.add(rel(sub.corePath, root));
    }
  }
  return [...out].sort();
}

function byTypeName(a: Card, b: Card): number {
  if (a.id.type !== b.id.type) return a.id.type < b.id.type ? -1 : 1;
  return a.id.name < b.id.name ? -1 : a.id.name > b.id.name ? 1 : 0;
}

export function knownTypesFromCards(cards: Card[]): Set<CardType> {
  const out = new Set<CardType>();
  for (const c of cards) out.add(c.id.type);
  return out;
}
