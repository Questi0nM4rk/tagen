import { filterCards } from "../lib/catalog";
import type { CatalogCard } from "../lib/types";

export function runList(cards: CatalogCard[], json: boolean, filter?: string): void {
  let filtered = cards;

  if (filter) {
    const [dim, val] = filter.split("=");
    if (dim && val) {
      filtered = filterCards(cards, { [dim]: [val] });
    }
  }

  if (json) {
    process.stdout.write(`${JSON.stringify(filtered.map(cardSummary), null, 2)}\n`);
    return;
  }

  if (filtered.length === 0) {
    process.stdout.write("No skills found.\n");
    return;
  }

  const header = `${"SKILL".padEnd(26)} ${"PLUGIN".padEnd(24)} ${"LAYER".padEnd(16)} ${"PHASE".padEnd(30)} LANGUAGE`;
  process.stdout.write(`${header}\n${"─".repeat(header.length)}\n`);

  for (const c of filtered) {
    const phases = c.tags.phase.join(", ");
    process.stdout.write(
      `${c.skill.padEnd(26)} ${c.plugin.padEnd(24)} ${c.tags.layer.padEnd(16)} ${phases.padEnd(30)} ${c.tags.language}\n`
    );
  }

  process.stdout.write(`\n${filtered.length} skill(s)\n`);
}

function cardSummary(c: CatalogCard) {
  return {
    skill: c.skill,
    plugin: c.plugin,
    layer: c.tags.layer,
    phase: c.tags.phase,
    language: c.tags.language,
    source: c.source,
  };
}
