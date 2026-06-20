import { rel } from "../lib/catalog.ts";
import {
  type Card,
  cardIndex,
  cardKey,
  isSubagentHostType,
  type Manifest,
} from "../lib/types.ts";
import type { SlotResolution } from "./resolve-slots.ts";

export function buildManifest(
  cards: readonly Card[],
  catalog: readonly Card[],
  root: string,
  slots: SlotResolution
): Manifest {
  const subagents = resolveSubagents(cards, catalog, root);
  const validators = cards
    .filter((card) => isSubagentHostType(card.id.type))
    .flatMap((card) => card.validators);
  const nonFillers = cards.filter((card) => !slots.fillerKeys.has(cardKey(card.id)));

  return Object.freeze({
    root,
    modules: Object.freeze(
      cards.map((card) =>
        Object.freeze({
          type: card.id.type,
          name: card.id.name,
          core: rel(card.corePath, root),
        })
      )
    ),
    core: Object.freeze(nonFillers.map((card) => rel(card.corePath, root))),
    references: Object.freeze(nonFillers.flatMap((card) => card.references)),
    filled: slots.filled,
    slots: slots.slots,
    subagents: Object.freeze(subagents.paths),
    validators: Object.freeze(validators),
    warnings: Object.freeze([...slots.warnings, ...subagents.warnings]),
  });
}

function resolveSubagents(
  cards: readonly Card[],
  catalog: readonly Card[],
  root: string
): { readonly paths: readonly string[]; readonly warnings: readonly string[] } {
  const index = cardIndex(catalog);
  const paths = new Set<string>();
  const warnings: string[] = [];

  for (const card of cards) {
    if (!isSubagentHostType(card.id.type)) continue;
    for (const name of card.frontmatter.subagents ?? []) {
      const subagent = index.get(cardKey({ type: "subagent", name }));
      if (!subagent) {
        warnings.push(`unknown subagent: ${name} referenced by ${cardKey(card.id)}`);
        continue;
      }
      paths.add(rel(subagent.corePath, root));
    }
  }
  return Object.freeze({
    paths: Object.freeze([...paths].sort()),
    warnings: Object.freeze(warnings),
  });
}
