import { buildManifest, type ComposeQuery, compose } from "../lib/compose";
import type { CatalogCard, ProtocolEntry, Subagent } from "../lib/types";

export interface GetOptions {
  json: boolean;
}

/**
 * Resolve a composition into a JSON manifest. Exit codes per SPEC-tagen:
 *   0 — manifest emitted (warnings OK)
 *   2 — empty match set
 * Caller validates the ComposeQuery before invoking runGet. Per spec:
 * stdout receives the JSON manifest; stderr receives any warnings.
 */
export function runGet(
  cards: CatalogCard[],
  subagents: Subagent[],
  protocols: ProtocolEntry[],
  repoRoot: string,
  q: ComposeQuery,
  opts: GetOptions
): void {
  const comp = compose(cards, subagents, q);

  if (comp.cards.length === 0) {
    process.stderr.write("No cards matched the query.\n");
    process.exit(2);
  }

  const manifest = buildManifest(comp, subagents, protocols, repoRoot);

  for (const w of manifest.warnings) {
    process.stderr.write(`! ${w}\n`);
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }

  process.stdout.write(`Composition for query: ${JSON.stringify(q)}\n\n`);
  process.stdout.write(
    `${manifest.modules.length} card(s), ${manifest.slots.length} slot(s), ${manifest.warnings.length} warning(s).\n`
  );
  process.stdout.write("\nUse --json for the full manifest.\n");
}
