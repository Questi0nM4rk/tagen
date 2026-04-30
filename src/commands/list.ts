import { type ComposeQuery, filterByQuery } from "../lib/compose";
import type { CatalogCard, Subagent } from "../lib/types";

export interface ListOptions {
  json: boolean;
}

export function runList(
  cards: CatalogCard[],
  q: ComposeQuery,
  opts: ListOptions
): void {
  const filtered = filterByQuery(cards, q);

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(filtered.map(cardSummary), null, 2)}\n`);
    return;
  }

  if (filtered.length === 0) {
    process.stdout.write("No skills found.\n");
    return;
  }

  for (const c of filtered) {
    process.stdout.write(`${formatCardBlock(c)}\n`);
  }

  process.stdout.write(`${filtered.length} skill(s)\n`);
}

/**
 * Render a single card as the multi-line block from SPEC-tagen `tagen list`
 * example: header (skill / language / layer + provides/requires), description,
 * and a tier-counts line (core: N file(s) deep: subagents/refs/validators/slots).
 * The shape matches the spec example so the agent can pick a card without
 * round-tripping through `tagen demo`.
 */
function formatCardBlock(c: CatalogCard): string {
  const langLayer = `${c.tags.language} / ${c.tags.layer}`;
  const provides = c.provides.length > 0 ? ` provides: [${c.provides.join(", ")}]` : "";
  const requires =
    c.requires.length > 0 ? `  requires: [${c.requires.join(", ")}]` : "";
  return [
    `  ${c.skill.padEnd(20)} ${langLayer.padEnd(28)}${provides}${requires}`,
    `    ${c.description}`,
    `    ${formatTierCounts(c)}`,
    "",
  ].join("\n");
}

function formatTierCounts(c: CatalogCard): string {
  const coreCount = c.core.files.length;
  const subagentCount = c.deep.subagents.length;
  const refCount = c.deep.refs.length;
  const validatorCount = c.deep.validators.length;
  const slotKeys = Object.keys(c.deep.slots);
  const deepParts: string[] = [];
  if (subagentCount > 0) {
    deepParts.push(`${subagentCount} subagent${subagentCount === 1 ? "" : "s"}`);
  }
  deepParts.push(`${refCount} ref${refCount === 1 ? "" : "s"}`);
  if (validatorCount > 0) {
    deepParts.push(`${validatorCount} validator${validatorCount === 1 ? "" : "s"}`);
  }
  if (slotKeys.length > 0) deepParts.push(`slots: [${slotKeys.join(", ")}]`);
  const corePart = `core: ${coreCount} file${coreCount === 1 ? "" : "s"}`;
  return `${corePart}  deep: ${deepParts.join(", ")}`;
}

export function runListSubagents(subagents: Subagent[], opts: ListOptions): void {
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(subagents.map(subSummary), null, 2)}\n`);
    return;
  }
  if (subagents.length === 0) {
    process.stdout.write("No subagents found.\n");
    return;
  }
  const header = `${"NAME".padEnd(28)} ${"MODEL".padEnd(8)} DESCRIPTION`;
  process.stdout.write(`${header}\n${"─".repeat(header.length)}\n`);
  for (const s of subagents) {
    process.stdout.write(
      `${s.name.padEnd(28)} ${s.model.padEnd(8)} ${s.description}\n`
    );
  }
  process.stdout.write(`\n${subagents.length} subagent(s)\n`);
}

function cardSummary(c: CatalogCard) {
  return {
    skill: c.skill,
    description: c.description,
    summary: c.summary,
    tags: c.tags,
    provides: c.provides,
    requires: c.requires,
    emits: c.emits,
    consumes: c.consumes,
    surface: { triggers: c.surface.triggers },
    core: { files: c.core.files.length },
    deep: {
      subagents: c.deep.subagents.length,
      refs: c.deep.refs.length,
      validators: c.deep.validators.length,
      slots: Object.keys(c.deep.slots),
    },
  };
}

function subSummary(s: Subagent) {
  return {
    name: s.name,
    model: s.model,
    description: s.description,
    consumes: s.consumes,
    emits: s.emits,
    references: s.references,
  };
}
