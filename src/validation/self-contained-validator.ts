import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rel } from "../lib/catalog.ts";
import type { Card } from "../lib/types.ts";

/**
 * Iron Law 14 — cards are self-contained. A card body (CORE.md or any
 * references/*.md) must never reference another card's `brain/<type>/<name>`
 * path. Cross-card composition is declared in `uses:`/`requires:` frontmatter;
 * own-card files are referenced via relative `references/...` paths.
 */
const INLINE_BRAIN_PATH = /\bbrain\/[a-z0-9_-]+\/[a-z0-9_-]+(?:\/[^\s)`,.;:]*)?/gi;

export function validateSelfContainment(
  cards: readonly Card[],
  root: string
): readonly string[] {
  return Object.freeze(
    cards.flatMap((card) =>
      cardBodyPaths(card, root).flatMap((path) => findInlineBrainPaths(path, root))
    )
  );
}

function cardBodyPaths(card: Card, root: string): readonly string[] {
  return [rel(card.corePath, root), ...card.references];
}

function findInlineBrainPaths(path: string, root: string): readonly string[] {
  const lines = readFileSync(join(root, path), "utf8").split(/\r?\n/);
  return lines.flatMap((line, index) =>
    [...line.matchAll(INLINE_BRAIN_PATH)].map(
      (match) =>
        `${path}:${index + 1}: inline brain path "${match[0]}": cards must be self-contained; use uses:/requires: or local references/ paths`
    )
  );
}
