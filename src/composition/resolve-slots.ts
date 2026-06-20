import { rel } from "../lib/catalog.ts";
import { ImmutableSet } from "../lib/immutable-collections.ts";
import type { Card, CardType, FilledSlot, ResolvedSlot } from "../lib/types.ts";
import { cardKey } from "../lib/types.ts";
import { byTypeName } from "./card-order.ts";

export interface SlotResolution {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly slots: readonly ResolvedSlot[];
  readonly filled: Readonly<Record<CardType, FilledSlot>>;
  readonly fillerKeys: ReadonlySet<string>;
}

export function resolveSlots(
  cards: readonly Card[],
  root: string,
  pins: ReadonlyMap<CardType, string>,
  knownTypes: ReadonlySet<CardType>
): SlotResolution {
  const requiredTypes = collectRequiredTypes(cards);
  const unknownTypes = requiredTypes.filter((type) => !knownTypes.has(type));
  if (unknownTypes.length > 0) {
    return emptyResolution(
      unknownTypes.map((type) => `unknown type in requires: ${type}`)
    );
  }

  const warnings: string[] = [];
  const slots: ResolvedSlot[] = [];
  const filled: Record<CardType, FilledSlot> = {};
  const fillerKeys: string[] = [];

  for (const type of requiredTypes) {
    resolveSlot(cards, root, pins, type, slots, filled, fillerKeys, warnings);
  }

  return Object.freeze({
    errors: Object.freeze([]),
    warnings: Object.freeze(warnings),
    slots: Object.freeze(slots),
    filled: Object.freeze(filled),
    fillerKeys: new ImmutableSet(fillerKeys),
  });
}

function resolveSlot(
  cards: readonly Card[],
  root: string,
  pins: ReadonlyMap<CardType, string>,
  type: CardType,
  slots: ResolvedSlot[],
  filled: Record<CardType, FilledSlot>,
  fillerKeys: string[],
  warnings: string[]
): void {
  const candidates = cards.filter((card) => card.id.type === type).sort(byTypeName);
  const names = candidates.map((card) => card.id.name);
  const chosen = chooseCandidate(candidates, pins.get(type), type, names, warnings);

  if (!chosen) {
    warnings.push(`unfilled slot for type ${type}`);
    slots.push(
      Object.freeze({
        type,
        fillerCard: "",
        candidates: Object.freeze(names),
      })
    );
    return;
  }
  if (candidates.length > 1) {
    warnings.push(
      `multiple candidates for type ${type}: ${names.join(", ")}. Picked ${chosen.id.name}. Use --pin ${type}=<name> to override.`
    );
  }
  slots.push(
    Object.freeze({
      type,
      fillerCard: chosen.id.name,
      candidates: Object.freeze(names),
    })
  );
  filled[type] = Object.freeze({
    core: rel(chosen.corePath, root),
    references: chosen.references,
  });
  fillerKeys.push(cardKey(chosen.id));
}

function chooseCandidate(
  candidates: readonly Card[],
  pin: string | undefined,
  type: CardType,
  names: readonly string[],
  warnings: string[]
): Card | undefined {
  if (pin === undefined) return candidates[0];
  const pinned = candidates.find((card) => card.id.name === pin);
  if (pinned) return pinned;
  warnings.push(
    `--pin ${type}=${pin} did not match any candidate (have: ${names.join(", ") || "none"})`
  );
  return candidates[0];
}

function collectRequiredTypes(cards: readonly Card[]): readonly CardType[] {
  const types = new Set<CardType>();
  for (const card of cards) {
    for (const required of card.frontmatter.requires ?? []) types.add(required);
  }
  return [...types].sort();
}

function emptyResolution(errors: readonly string[]): SlotResolution {
  return Object.freeze({
    errors: Object.freeze([...errors]),
    warnings: Object.freeze([]),
    slots: Object.freeze([]),
    filled: Object.freeze({}),
    fillerKeys: new ImmutableSet<string>(),
  });
}
