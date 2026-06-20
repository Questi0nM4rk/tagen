import { expandDirectUses } from "../lib/card-references.ts";
import { ImmutableMap, ImmutableSet } from "../lib/immutable-collections.ts";
import type { Card, CardType } from "../lib/types.ts";
import { buildManifest } from "./build-manifest.ts";
import { byTypeName } from "./card-order.ts";
import type { ComposeOutcome, ComposeQuery } from "./contracts.ts";
import { matchCards } from "./match-cards.ts";
import { resolveSlots } from "./resolve-slots.ts";

export type { ComposeOutcome, ComposeQuery } from "./contracts.ts";

export function emptyQuery(): ComposeQuery {
  return Object.freeze({
    positional: Object.freeze([]),
    explicit: Object.freeze([]),
    pins: new ImmutableMap<CardType, string>(),
  });
}

/**
 * Resolve a query into a manifest per SPEC-tagen "Resolution algorithm".
 *
 * `cards` is the full catalog. `root` is the marketplace dir (parent of brain/).
 * `knownTypes` is every dir name under brain/ — used both for slot validation
 * and for browse-intent detection on bare type-name positional args.
 */
export function compose(
  cards: readonly Card[],
  root: string,
  query: ComposeQuery,
  knownTypes: ReadonlySet<CardType>
): ComposeOutcome {
  const matched = matchCards(cards, query, knownTypes);
  if (matched.errors.length > 0 || matched.emptyMatch) {
    return outcome({
      errors: matched.errors,
      browseTypes: matched.browseTypes,
      emptyMatch: matched.emptyMatch,
    });
  }
  if (matched.cards.length === 0) {
    return outcome({
      errors: [],
      browseTypes: matched.browseTypes,
      emptyMatch: false,
    });
  }

  const expanded = expandDirectUses(matched.cards, cards);
  if (expanded.errors.length > 0) {
    return outcome({
      errors: expanded.errors,
      browseTypes: matched.browseTypes,
      emptyMatch: false,
    });
  }
  const composition = [...expanded.cards].sort(byTypeName);
  const slots = resolveSlots(composition, root, query.pins, knownTypes);
  if (slots.errors.length > 0) {
    return outcome({
      errors: slots.errors,
      browseTypes: matched.browseTypes,
      emptyMatch: false,
    });
  }

  return outcome({
    manifest: buildManifest(composition, cards, root, slots),
    errors: [],
    browseTypes: matched.browseTypes,
    emptyMatch: false,
  });
}

function outcome(value: ComposeOutcome): ComposeOutcome {
  return Object.freeze({
    ...value,
    errors: Object.freeze([...value.errors]),
    browseTypes: Object.freeze([...value.browseTypes]),
  });
}

export function knownTypesFromCards(cards: readonly Card[]): ReadonlySet<CardType> {
  return new ImmutableSet(cards.map((card) => card.id.type));
}
