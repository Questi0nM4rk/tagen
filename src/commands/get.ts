import { buildManifest, type ComposeQuery, compose } from "../lib/compose";
import type { CatalogCard, ProtocolEntry, Subagent } from "../lib/types";

/**
 * Resolve a composition into a JSON manifest. Exit codes per SPEC-004:
 *   0 — manifest written (warnings OK)
 *   2 — empty match set
 * Exit 1 (validation error) is the caller's responsibility.
 */
export function runGet(
  cards: CatalogCard[],
  subagents: Subagent[],
  protocols: ProtocolEntry[],
  repoRoot: string,
  q: ComposeQuery,
  asJson: boolean
): void {
  const comp = compose(cards, subagents, q);

  if (comp.cards.length === 0) {
    process.stderr.write("No cards matched the query.\n");
    process.exit(2);
  }

  const manifest = buildManifest(comp, subagents, protocols, repoRoot);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }

  // Non-JSON fallback: pretty-print the manifest in a compact form.
  process.stdout.write(`Composition for query: ${JSON.stringify(q)}\n\n`);
  process.stdout.write(
    `${manifest.modules.length} card(s), ${manifest.slots.length} slot(s), ${manifest.warnings.length} warning(s).\n`
  );
  process.stdout.write("\nUse --json for the full manifest.\n");
}
