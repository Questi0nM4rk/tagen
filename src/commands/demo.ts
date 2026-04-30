import { type ComposeQuery, compose } from "../lib/compose";
import type { CatalogCard, Subagent, SubagentModel } from "../lib/types";

export interface DemoOptions {
  verbose: boolean;
}

/**
 * Preview a composition. Exit codes per SPEC-tagen:
 *   0 — success (warnings OK)
 *   2 — empty match set
 * Caller validates the ComposeQuery before invoking runDemo.
 *
 * Output mirrors the spec example: Modules → Capabilities → Slots →
 * Protocols → Subagents (model breakdown) → Warnings. --verbose adds a
 * resolution trace.
 */
export function runDemo(
  cards: CatalogCard[],
  subagents: Subagent[],
  q: ComposeQuery,
  opts: DemoOptions = { verbose: false }
): void {
  const comp = compose(cards, subagents, q);

  if (comp.cards.length === 0) {
    process.stderr.write("No cards matched the query.\n");
    process.exit(2);
  }

  process.stdout.write(`  Modules: ${comp.cards.map((c) => c.skill).join(", ")}\n\n`);

  printCapabilities(comp.cards);
  printSlots(comp);
  printProtocols(comp.cards);
  printSubagentSummary(comp.cards, subagents);
  printWarnings(comp.warnings);

  if (opts.verbose) {
    process.stdout.write("\n  Resolution trace:\n");
    for (const c of comp.cards) {
      process.stdout.write(
        `    card '${c.skill}' provides: [${c.provides.join(", ")}] requires: [${c.requires.join(", ")}]\n`
      );
      if (c.deep.subagents.length > 0) {
        process.stdout.write(`      deep.subagents: ${c.deep.subagents.join(", ")}\n`);
      }
    }
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function printCapabilities(cards: CatalogCard[]): void {
  const provided = uniqueSorted(cards.flatMap((c) => c.provides));
  const required = uniqueSorted(cards.flatMap((c) => c.requires));
  process.stdout.write("  Capabilities:\n");
  process.stdout.write(`    provided: ${provided.join(", ") || "(none)"}\n`);
  process.stdout.write(`    required: ${required.join(", ") || "(none)"}\n\n`);
}

function printSlots(comp: {
  slots: { capability: string; fillerCard: string; candidates: string[] }[];
}): void {
  process.stdout.write(`  Slots (${comp.slots.length}):\n`);
  if (comp.slots.length === 0) {
    process.stdout.write("    (none)\n\n");
    return;
  }
  for (const s of comp.slots) {
    const extra =
      s.candidates.length > 1 ? ` (candidates: ${s.candidates.join(", ")})` : "";
    process.stdout.write(`    ${s.capability} ← ${s.fillerCard}${extra}\n`);
  }
  process.stdout.write("\n");
}

function printProtocols(cards: CatalogCard[]): void {
  const emits = uniqueSorted(cards.flatMap((c) => c.emits));
  const consumes = uniqueSorted(cards.flatMap((c) => c.consumes));
  process.stdout.write("  Protocols:\n");
  process.stdout.write(`    emits:    ${emits.join(", ") || "(none)"}\n`);
  process.stdout.write(`    consumes: ${consumes.join(", ") || "(none)"}\n\n`);
}

function printSubagentSummary(cards: CatalogCard[], subagents: Subagent[]): void {
  const names = new Set(cards.flatMap((c) => c.deep.subagents));
  const matched = subagents.filter((s) => names.has(s.name));
  const counts: Record<SubagentModel, number> = { haiku: 0, sonnet: 0, opus: 0 };
  for (const s of matched) counts[s.model] += 1;
  const breakdown = (["haiku", "sonnet", "opus"] as const)
    .filter((m) => counts[m] > 0)
    .map((m) => `${counts[m]} ${m}`)
    .join(", ");
  process.stdout.write(
    `  Subagents: ${matched.length} total${breakdown ? ` (${breakdown})` : ""}\n\n`
  );
}

function printWarnings(warnings: string[]): void {
  if (warnings.length === 0) {
    process.stdout.write("  Warnings: none\n");
    return;
  }
  process.stdout.write(`  Warnings (${warnings.length}):\n`);
  for (const w of warnings) {
    process.stdout.write(`    ! ${w}\n`);
  }
}
