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

  const header = `${"SKILL".padEnd(28)} ${"LANGUAGE".padEnd(12)} ${"LAYER".padEnd(14)} ${"PHASE".padEnd(28)} DOMAIN`;
  process.stdout.write(`${header}\n${"─".repeat(header.length)}\n`);

  for (const c of filtered) {
    const phases = c.tags.phase.join(", ");
    const domains = c.tags.domain.join(", ");
    process.stdout.write(
      `${c.skill.padEnd(28)} ${c.tags.language.padEnd(12)} ${c.tags.layer.padEnd(14)} ${phases.padEnd(28)} ${domains}\n`
    );
  }

  process.stdout.write(`\n${filtered.length} skill(s)\n`);
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
    tags: c.tags,
    provides: c.provides,
    requires: c.requires,
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
