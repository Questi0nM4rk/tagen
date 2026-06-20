import type { Card } from "../lib/types.ts";

export function byTypeName(left: Card, right: Card): number {
  if (left.id.type !== right.id.type) {
    return left.id.type < right.id.type ? -1 : 1;
  }
  return left.id.name < right.id.name ? -1 : left.id.name > right.id.name ? 1 : 0;
}
