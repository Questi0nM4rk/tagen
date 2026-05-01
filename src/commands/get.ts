import { type ComposeQuery, compose, knownTypesFromCards } from "../lib/compose.ts";
import type { Card } from "../lib/types.ts";
import { runList } from "./list.ts";

export interface GetOptions {
  json: boolean;
}

/**
 * Resolve a composition into a JSON manifest. Bare type-name positional args
 * trigger a browse intent (delegated to `runList --type T`).
 *
 * Exit codes per SPEC-tagen:
 *   0 — manifest emitted (warnings allowed) OR browse listing emitted
 *   1 — user/validation error (ambiguous arg, unknown card)
 *   2 — empty match set
 */
export function runGet(
  cards: Card[],
  root: string,
  query: ComposeQuery,
  opts: GetOptions
): void {
  const knownTypes = knownTypesFromCards(cards);
  const outcome = compose(cards, root, query, knownTypes);

  if (outcome.errors.length > 0) {
    for (const e of outcome.errors) process.stderr.write(`tagen: ${e}\n`);
    process.exit(1);
  }

  if (outcome.browseTypes.length > 0 && !outcome.manifest) {
    for (const type of outcome.browseTypes) {
      runList(cards, { json: opts.json, type, aliases: false });
    }
    return;
  }

  if (outcome.emptyMatch || !outcome.manifest) {
    process.stderr.write("tagen: no cards matched the query\n");
    process.exit(2);
  }

  for (const w of outcome.manifest.warnings) {
    process.stderr.write(`tagen: ${w}\n`);
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(outcome.manifest, null, 2)}\n`);
    return;
  }

  const m = outcome.manifest;
  process.stdout.write(
    `${m.modules.length} card(s), ${m.slots.length} slot(s), ${m.warnings.length} warning(s).\n`
  );
  process.stdout.write("Use --json for the full manifest.\n");
}
