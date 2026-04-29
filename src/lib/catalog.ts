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
  // v2 cards only require `skill`. `plugin` and `source` are v1 fields kept
  // for backward compat — v2 modules resolve by convention to brain/<skill>/.
  if (!yaml.skill) return null;

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

  const surfaceRaw = (yaml.surface ?? {}) as Record<string, unknown>;
  const coreRaw = (yaml.core ?? {}) as Record<string, unknown>;
  const deepRaw = (yaml.deep ?? {}) as Record<string, unknown>;
  const slotsRaw = (deepRaw.slots ?? {}) as Record<string, unknown>;
  const slots: Record<string, true> = {};
  for (const k of Object.keys(slotsRaw)) slots[k] = true;

  return {
    skill: String(yaml.skill),
    plugin: String(yaml.plugin ?? ""),
    source: String(yaml.source ?? ""),
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
    summary: toStringArray(yaml.summary),
    provides: toStringArray(yaml.provides),
    requires: toStringArray(yaml.requires),
    emits: toStringArray(yaml.emits),
    consumes: toStringArray(yaml.consumes),
    surface: {
      triggers: toStringArray(surfaceRaw.triggers),
    },
    core: {
      files: toStringArray(coreRaw.files),
    },
    deep: {
      subagents: toStringArray(deepRaw.subagents),
      refs: toStringArray(deepRaw.refs),
      slots,
      validators: toStringArray(deepRaw.validators),
    },
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

  // Pre-compute index maps so the comparator is O(1) per lookup instead of
  // O(P) via indexOf. With N log N comparisons this matters at 100+ cards.
  const phaseIndex = new Map(phaseOrder.map((p, i) => [p, i]));
  const layerIndex = new Map(layerOrder.map((l, i) => [l, i]));
  const END = phaseOrder.length;

  return [...cards].sort((a, b) => {
    // Sort by earliest phase (unknown phases sort to end)
    let aPhase = END;
    for (const p of a.tags.phase) {
      const i = phaseIndex.get(p);
      if (i !== undefined && i < aPhase) aPhase = i;
    }
    let bPhase = END;
    for (const p of b.tags.phase) {
      const i = phaseIndex.get(p);
      if (i !== undefined && i < bPhase) bPhase = i;
    }
    if (aPhase !== bPhase) return aPhase - bPhase;

    // Within same phase, sort by layer
    const aLayer = layerIndex.get(a.tags.layer) ?? -1;
    const bLayer = layerIndex.get(b.tags.layer) ?? -1;
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
  // Build lookup map once so each composes resolution is O(1) instead of O(N).
  const cardBySkill = new Map(allCards.map((c) => [c.skill, c]));
  const inPath = new Set(path.map((c) => c.skill));
  const expanded: CatalogCard[] = [];

  for (const card of path) {
    for (const composed of card.composes) {
      if (!inPath.has(composed)) {
        const found = cardBySkill.get(composed);
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
