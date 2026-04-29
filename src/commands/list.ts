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

function cardSummary(c: CatalogCard) {
  return {
    skill: c.skill,
    description: c.description,
    tags: c.tags,
    provides: c.provides,
    requires: c.requires,
  };
}
