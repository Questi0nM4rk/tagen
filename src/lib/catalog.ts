import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { CatalogCard, Vocabulary } from "./types";
import { getOrder } from "./vocabulary";

function parseCard(filePath: string): CatalogCard | null {
  const raw = readFileSync(filePath, "utf8");
  const parts = raw.split("---");
  if (parts.length < 3) return null;

  const yaml = parseYaml(parts[1]) as Record<string, unknown>;
  if (!yaml.skill || !yaml.plugin || !yaml.source) return null;

  const tags = (yaml.tags ?? {}) as Record<string, unknown>;

  const body = parts.slice(2).join("---").trim();

  // Prefer explicit description from YAML; fall back to first non-heading line
  let description: string;
  if (typeof yaml.description === "string" && yaml.description.trim()) {
    description = yaml.description.trim();
  } else {
    const lines = body.split("\n").filter((l) => !l.startsWith("#") && l.trim());
    description = lines[0]?.trim() ?? "";
  }

  return {
    skill: String(yaml.skill),
    plugin: String(yaml.plugin),
    source: String(yaml.source),
    tags: {
      phase: toStringArray(tags.phase),
      domain: toStringArray(tags.domain),
      language: String(tags.language ?? "agnostic"),
      layer: String(tags.layer ?? "reference"),
      concerns: toStringArray(tags.concerns),
    },
    composes: toStringArray(yaml.composes),
    enhances: toStringArray(yaml.enhances),
    description,
    ironLaws: toStringArray(yaml.iron_laws),
    body,
    filePath,
  };
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

/**
 * Load all catalog cards from the vault skills/ directory.
 */
export function loadAllCards(vaultDir: string): CatalogCard[] {
  const skillsDir = join(vaultDir, "skills");
  if (!existsSync(skillsDir)) return [];

  const files = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
  const cards: CatalogCard[] = [];

  for (const file of files) {
    const card = parseCard(join(skillsDir, file));
    if (card) cards.push(card);
  }

  return cards;
}

function getArrayDimension(card: CatalogCard, dim: string): string[] {
  switch (dim) {
    case "phase":
      return card.tags.phase;
    case "domain":
      return card.tags.domain;
    case "concerns":
      return card.tags.concerns;
    case "layer":
      return [card.tags.layer];
    default:
      return [];
  }
}

/**
 * Filter cards by tag query. AND across dimensions, OR within a dimension.
 */
export function filterCards(
  cards: CatalogCard[],
  filters: Record<string, string[]>
): CatalogCard[] {
  return cards.filter((card) => {
    for (const [dim, filterValues] of Object.entries(filters)) {
      if (filterValues.length === 0) continue;

      if (dim === "language") {
        // Language is single-valued — match if filter includes it or "agnostic"
        if (
          !filterValues.includes(card.tags.language) &&
          card.tags.language !== "agnostic"
        ) {
          return false;
        }
      } else {
        const cardValues = getArrayDimension(card, dim);
        if (!filterValues.some((fv) => cardValues.includes(fv))) {
          return false;
        }
      }
    }
    return true;
  });
}

/**
 * Sort cards by phase order, then by layer order within same phase.
 */
export function sortCards(cards: CatalogCard[], vocab: Vocabulary): CatalogCard[] {
  const phaseOrder = getOrder(vocab, "phase");
  const layerOrder = getOrder(vocab, "layer");

  const END = phaseOrder.length;
  return [...cards].sort((a, b) => {
    // Sort by earliest phase (unknown phases sort to end)
    const aIndices = a.tags.phase
      .map((p) => phaseOrder.indexOf(p))
      .filter((i) => i >= 0);
    const bIndices = b.tags.phase
      .map((p) => phaseOrder.indexOf(p))
      .filter((i) => i >= 0);
    const aPhase = aIndices.length > 0 ? Math.min(...aIndices) : END;
    const bPhase = bIndices.length > 0 ? Math.min(...bIndices) : END;
    if (aPhase !== bPhase) return aPhase - bPhase;

    // Within same phase, sort by layer
    const aLayer = layerOrder.indexOf(a.tags.layer);
    const bLayer = layerOrder.indexOf(b.tags.layer);
    return aLayer - bLayer;
  });
}

/**
 * Expand composes relationships — add composed skills not already in the list.
 */
export function expandComposes(
  path: CatalogCard[],
  allCards: CatalogCard[]
): CatalogCard[] {
  const inPath = new Set(path.map((c) => c.skill));
  const expanded: CatalogCard[] = [];

  for (const card of path) {
    for (const composed of card.composes) {
      if (!inPath.has(composed)) {
        const found = allCards.find((c) => c.skill === composed);
        if (found) {
          expanded.push(found);
          inPath.add(composed);
        }
      }
    }
  }

  return [...path, ...expanded];
}

/**
 * Check that a card's source SKILL.md actually exists on disk.
 */
export function sourceExists(card: CatalogCard, repoRoot: string): boolean {
  return existsSync(resolve(repoRoot, card.source));
}
