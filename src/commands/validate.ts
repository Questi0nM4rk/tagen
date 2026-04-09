import { existsSync } from "node:fs";
import { join } from "node:path";
import { findOrphansAndPhantoms, loadMarketplace } from "../lib/build-utils";
import { sourceExists } from "../lib/catalog";
import type { CatalogCard, Vocabulary } from "../lib/types";
import { validateCard } from "../lib/vocabulary";

export function runValidate(
  cards: CatalogCard[],
  vocab: Vocabulary,
  root: string
): void {
  const errors: string[] = [];
  const allSkillNames = new Set(cards.map((c) => c.skill));
  const seenNames = new Set<string>();

  for (const card of cards) {
    if (seenNames.has(card.skill)) {
      errors.push(`[${card.skill}] duplicate skill name`);
    }
    seenNames.add(card.skill);

    errors.push(...validateCard(card, vocab));

    if (!sourceExists(card, root)) {
      errors.push(`[${card.skill}] source not found: ${card.source}`);
    }

    for (const ref of [...card.composes, ...card.enhances]) {
      if (!allSkillNames.has(ref)) {
        errors.push(`[${card.skill}] references unknown skill: "${ref}"`);
      }
    }
  }

  // Marketplace cross-check — load once, reuse for both null check and orphan detection
  const mpPath = join(root, ".claude-plugin", "marketplace.json");
  const marketplace = existsSync(mpPath) ? loadMarketplace(root) : undefined;
  if (existsSync(mpPath) && marketplace === null) {
    errors.push("[marketplace] marketplace.json exists but is invalid or unreadable");
  }
  const { orphans, phantoms } = findOrphansAndPhantoms(root, marketplace);
  for (const name of orphans) {
    errors.push(
      `[marketplace] orphan plugin: plugins/${name}/ not in marketplace.json`
    );
  }
  for (const name of phantoms) {
    errors.push(
      `[marketplace] phantom entry: ${name} in marketplace.json but directory missing`
    );
  }

  if (errors.length === 0) {
    process.stdout.write(`All ${cards.length} card(s) valid.\n`);
    process.exit(0);
  }

  process.stderr.write(`${errors.length} error(s):\n`);
  for (const err of errors) {
    process.stderr.write(`  ${err}\n`);
  }
  process.exit(1);
}
