import type { Card } from "../lib/types.ts";

/**
 * Compares two cards by type, then by name, for deterministic sorting.
 */
export function byTypeName(left: Card, right: Card): number {
  if (left.id.type !== right.id.type) {
    return left.id.type < right.id.type ? -1 : 1;
  }
  return left.id.name < right.id.name ? -1 : left.id.name > right.id.name ? 1 : 0;
}
