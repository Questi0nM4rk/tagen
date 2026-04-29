import { type ComposeQuery, compose } from "../lib/compose";
import type { CatalogCard, Subagent } from "../lib/types";

/**
 * Preview a composition. Exit codes per SPEC-004:
 *   0 — success (warnings OK)
 *   2 — empty match set
 * Exit 1 (validation error) is the caller's responsibility — it must validate
 * the ComposeQuery against vocabulary/capabilities before invoking runDemo.
 */
export function runDemo(
  cards: CatalogCard[],
  subagents: Subagent[],
  q: ComposeQuery
): void {
  const comp = compose(cards, subagents, q);

  if (comp.cards.length === 0) {
    process.stderr.write("No cards matched the query.\n");
    process.exit(2);
  }

  process.stdout.write(`Matched ${comp.cards.length} card(s):\n`);
  for (const c of comp.cards) {
    process.stdout.write(`  - ${c.skill}\n`);
  }
  process.stdout.write("\n");

  process.stdout.write(`Slot fills (${comp.slots.length}):\n`);
  for (const s of comp.slots) {
    const extra =
      s.candidates.length > 1 ? ` (candidates: ${s.candidates.join(", ")})` : "";
    process.stdout.write(`  - ${s.capability} ← ${s.fillerCard}${extra}\n`);
  }
  process.stdout.write("\n");

  if (comp.warnings.length === 0) {
    process.stdout.write("No warnings.\n");
  } else {
    process.stdout.write(`Warnings (${comp.warnings.length}):\n`);
    for (const w of comp.warnings) {
      process.stdout.write(`  ! ${w}\n`);
    }
  }
}
