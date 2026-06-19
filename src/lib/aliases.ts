import { type Card, type CardId, cardKey } from "./types.ts";

/**
 * Detect global alias collisions across the catalog. Two failure modes:
 *   1. an alias collides with another card's canonical name
 *   2. the same alias appears on two different cards
 *
 * Pure detection — caller decides whether to surface as `tagen validate`
 * violations, `tagen get` errors, or both.
 */
export function findAliasCollisions(cards: Card[]): string[] {
  const errors: string[] = [];
  const canonical = new Map<string, CardId>();
  for (const c of cards) canonical.set(c.id.name, c.id);

  const seen = new Map<string, CardId>();
  for (const c of cards) {
    for (const alias of c.frontmatter.aliases ?? []) {
      const collidingCanonical = canonical.get(alias);
      if (collidingCanonical) {
        errors.push(
          `alias '${alias}' on ${cardKey(c.id)} collides with canonical name ${cardKey(collidingCanonical)}`
        );
      }
      const prior = seen.get(alias);
      if (prior) {
        errors.push(
          `alias '${alias}' collides between ${cardKey(prior)} and ${cardKey(c.id)}`
        );
      } else {
        seen.set(alias, c.id);
      }
    }
  }
  return errors;
}
