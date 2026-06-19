import { type Card, cardIndex, cardKey, KEBAB_NAME } from "./types.ts";

export interface UsesResolution {
  cards: Card[];
  errors: string[];
}

/** Resolve canonical `<type>/<name>` IDs declared by one card. */
export function resolveUses(owner: Card, cards: Card[]): UsesResolution {
  const index = cardIndex(cards);
  const resolved: Card[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const target of owner.frontmatter.uses ?? []) {
    if (!isCardKey(target)) {
      errors.push(
        `${cardKey(owner.id)}: invalid uses target '${target}', expected <type>/<name>`
      );
      continue;
    }
    if (target === cardKey(owner.id)) {
      errors.push(`${cardKey(owner.id)}: uses cannot reference itself`);
      continue;
    }
    const card = index.get(target);
    if (!card) {
      errors.push(`${cardKey(owner.id)}: unknown card in uses: ${target}`);
      continue;
    }
    if (!seen.has(target)) {
      seen.add(target);
      resolved.push(card);
    }
  }

  return { cards: resolved, errors };
}

/** Expand only direct uses from the original seed set. */
export function expandDirectUses(seeds: Card[], cards: Card[]): UsesResolution {
  const expanded = new Map(seeds.map((card) => [cardKey(card.id), card] as const));
  const errors: string[] = [];

  for (const seed of seeds) {
    const result = resolveUses(seed, cards);
    errors.push(...result.errors);
    for (const card of result.cards) expanded.set(cardKey(card.id), card);
  }

  return { cards: [...expanded.values()], errors };
}

/** Detect cycles in the concrete uses graph and render each cycle once. */
export function findUsesCycles(cards: Card[]): string[] {
  const edges = new Map<string, string[]>();
  for (const card of cards) {
    const owner = cardKey(card.id);
    edges.set(
      owner,
      (card.frontmatter.uses ?? []).filter((target) => isCardKey(target))
    );
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const cycles = new Set<string>();

  const visit = (node: string): void => {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      const cycle = [...stack.slice(start), node].join(" -> ");
      cycles.add(cycle);
      return;
    }
    visiting.add(node);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      if (edges.has(next)) visit(next);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  };

  for (const node of [...edges.keys()].sort()) visit(node);
  return [...cycles].sort().map((cycle) => `uses cycle: ${cycle}`);
}

function isCardKey(value: string): boolean {
  const parts = value.split("/");
  return (
    parts.length === 2 &&
    parts[0] !== undefined &&
    parts[1] !== undefined &&
    KEBAB_NAME.test(parts[0]) &&
    KEBAB_NAME.test(parts[1])
  );
}
