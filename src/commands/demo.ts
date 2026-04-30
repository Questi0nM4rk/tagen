import { type ComposeQuery, type Composition, compose } from "../lib/compose";
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

  printCapabilities(comp);
  printSlots(comp);
  printProtocols(comp.cards);
  printSubagentSummary(comp.cards, subagents);
  printContext(comp.cards, subagents);
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

function printCapabilities(comp: Composition): void {
  const provided = uniqueSorted(comp.cards.flatMap((c) => c.provides));
  const required = uniqueSorted(comp.cards.flatMap((c) => c.requires));
  const fillerByCap = new Map(comp.slots.map((s) => [s.capability, s.fillerCard]));
  process.stdout.write("  Capabilities:\n");
  process.stdout.write(`    provided: ${provided.join(", ") || "(none)"}\n`);
  if (required.length === 0) {
    process.stdout.write("    required: (none)\n\n");
    return;
  }
  const annotated = required
    .map((cap) => {
      const filler = fillerByCap.get(cap);
      return filler ? `${cap} OK (filled by ${filler})` : `${cap} UNMET`;
    })
    .join(", ");
  process.stdout.write(`    required: ${annotated}\n\n`);
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

// Token estimates: ~500/core file, ~2000/subagent, ~500/ref. Back-of-envelope
// from SPEC tier semantics; see #17. Rough enough that "~2500 tok" reads as a
// budget hint rather than a billing line — the agent uses it to plan, not to
// gate on.
const TOK_PER_CORE = 500;
const TOK_PER_SUBAGENT = 2000;
const TOK_PER_REF = 500;
const TOK_PER_VALIDATOR = 0;

function printContext(cards: CatalogCard[], subagents: Subagent[]): void {
  let coreFiles = 0;
  let refs = 0;
  let validators = 0;
  for (const c of cards) {
    coreFiles += c.core.files.length;
    refs += c.deep.refs.length;
    validators += c.deep.validators.length;
  }
  const subagentNames = new Set(cards.flatMap((c) => c.deep.subagents));
  const subagentCount = subagents.filter((s) => subagentNames.has(s.name)).length;
  const coreTok = coreFiles * TOK_PER_CORE;
  const deepTok =
    subagentCount * TOK_PER_SUBAGENT +
    refs * TOK_PER_REF +
    validators * TOK_PER_VALIDATOR;
  process.stdout.write(
    `  Context: core ${coreFiles} ${coreFiles === 1 ? "file" : "files"} (~${coreTok} tok), deep ${subagentCount} subagents + ${refs} refs + ${validators} validators (~${deepTok} tok)\n\n`
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
