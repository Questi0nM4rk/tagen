import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { CatalogCard, Vocabulary } from "./types";
import { getOrder } from "./vocabulary";

/** Frontmatter keys removed in SPEC-tagen — `validate` hard-errors on them. */
const LEGACY_FIELDS = [
  "source",
  "plugin",
  "composes",
  "enhances",
  "iron_laws",
] as const;

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

function detectLegacy(yaml: Record<string, unknown>): string[] {
  const found: string[] = LEGACY_FIELDS.filter((k) => k in yaml);
  const deep = yaml.deep as Record<string, unknown> | undefined;
  if (deep && Array.isArray(deep.agents)) found.push("deep.agents");
  return found;
}

function parseCard(filePath: string): CatalogCard | null {
  const raw = readFileSync(filePath, "utf8");
  const parts = raw.split("---");
  if (parts.length < 3) return null;

  const yaml = parseYaml(parts[1]) as Record<string, unknown> | null;
  if (!yaml || typeof yaml !== "object") return null;
  if (!yaml.skill) return null;

  const tags = (yaml.tags ?? {}) as Record<string, unknown>;
  const surfaceRaw = (yaml.surface ?? {}) as Record<string, unknown>;
  const coreRaw = (yaml.core ?? {}) as Record<string, unknown>;
  const deepRaw = (yaml.deep ?? {}) as Record<string, unknown>;
  const slotsRaw = (deepRaw.slots ?? {}) as Record<string, unknown>;
  const slots: Record<string, true> = {};
  for (const k of Object.keys(slotsRaw)) slots[k] = true;

  const description =
    typeof yaml.description === "string" ? yaml.description.trim() : "";

  return {
    skill: String(yaml.skill),
    description,
    summary: toStringArray(yaml.summary),
    tags: {
      phase: toStringArray(tags.phase),
      domain: toStringArray(tags.domain),
      language: String(tags.language ?? "agnostic"),
      layer: String(tags.layer ?? "reference"),
      concerns: toStringArray(tags.concerns),
    },
    provides: toStringArray(yaml.provides),
    requires: toStringArray(yaml.requires),
    emits: toStringArray(yaml.emits),
    consumes: toStringArray(yaml.consumes),
    surface: { triggers: toStringArray(surfaceRaw.triggers) },
    core: { files: toStringArray(coreRaw.files) },
    deep: {
      subagents: toStringArray(deepRaw.subagents),
      refs: toStringArray(deepRaw.refs),
      slots,
      validators: toStringArray(deepRaw.validators),
    },
    body: parts.slice(2).join("---").trim(),
    filePath,
    legacyFields: detectLegacy(yaml),
  };
}

/** Load all catalog cards from the vault skills/ directory. */
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

/** Filter cards by tag query. AND across dimensions, OR within a dimension. */
export function filterCards(
  cards: CatalogCard[],
  filters: Record<string, string[]>
): CatalogCard[] {
  return cards.filter((card) => {
    for (const [dim, filterValues] of Object.entries(filters)) {
      if (filterValues.length === 0) continue;

      if (dim === "language") {
        // Single-valued; match the filter OR `agnostic`.
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

/** Sort cards by phase order, then by layer order within same phase. */
export function sortCards(cards: CatalogCard[], vocab: Vocabulary): CatalogCard[] {
  const phaseOrder = getOrder(vocab, "phase");
  const layerOrder = getOrder(vocab, "layer");
  const phaseIndex = new Map(phaseOrder.map((p, i) => [p, i]));
  const layerIndex = new Map(layerOrder.map((l, i) => [l, i]));
  const END = phaseOrder.length;

  return [...cards].sort((a, b) => {
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

    const aLayer = layerIndex.get(a.tags.layer) ?? -1;
    const bLayer = layerIndex.get(b.tags.layer) ?? -1;
    return aLayer - bLayer;
  });
}
