import { join, relative } from "node:path";
import { filterCards } from "./catalog";
import type { CatalogCard, ProtocolEntry, Subagent } from "./types";

/**
 * Tag query for `tagen list` / `demo` / `get`. All array fields are repeatable;
 * `language` is single-valued and matched inclusively (matches its value OR
 * `agnostic`). `cards` is an override — when non-empty it bypasses every other
 * filter and restricts the matched set to exactly those skill names.
 */
export interface ComposeQuery {
  phase?: string[];
  domain?: string[];
  language?: string;
  layer?: string[];
  concerns?: string[];
  capability?: string[];
  protocol?: string[];
  cards?: string[];
}

export interface ResolvedSlot {
  capability: string;
  fillerCard: string;
  candidates: string[];
}

export interface Composition {
  cards: CatalogCard[];
  slots: ResolvedSlot[];
  warnings: string[];
}

/**
 * Compose a manifest from a tag query.
 *
 * Initial set: cards matching the tag query (or `--card` overrides).
 * Slot resolution: for every `requires:` capability on each card, and every
 *   `references:` capability on each subagent listed by `deep.subagents`,
 *   find providers in the matched set. Pick the first provider by alphabetical
 *   card name. Warn when N>1 candidates exist; warn when no provider exists.
 */
/**
 * Filter cards by a ComposeQuery. Returns the matched set sorted by skill.
 * `cards` override (when present) bypasses every other filter; otherwise
 * tag dimensions AND together, capability/protocol filters intersect last.
 * Shared by `compose()` and `tagen list`.
 */
export function filterByQuery(cards: CatalogCard[], q: ComposeQuery): CatalogCard[] {
  let matched: CatalogCard[];
  if (q.cards?.length) {
    const wanted = new Set(q.cards);
    matched = cards.filter((c) => wanted.has(c.skill));
  } else {
    const filters: Record<string, string[]> = {};
    if (q.phase?.length) filters["phase"] = q.phase;
    if (q.domain?.length) filters["domain"] = q.domain;
    if (q.language) filters["language"] = [q.language];
    if (q.layer?.length) filters["layer"] = q.layer;
    if (q.concerns?.length) filters["concerns"] = q.concerns;
    matched = filterCards(cards, filters);

    if (q.capability?.length) {
      const caps = new Set(q.capability);
      matched = matched.filter((c) => c.provides.some((p) => caps.has(p)));
    }
    if (q.protocol?.length) {
      const protos = new Set(q.protocol);
      matched = matched.filter(
        (c) =>
          c.emits.some((p) => protos.has(p)) || c.consumes.some((p) => protos.has(p))
      );
    }
  }
  return [...matched].sort((a, b) => a.skill.localeCompare(b.skill));
}

export function compose(
  cards: CatalogCard[],
  subagents: Subagent[],
  q: ComposeQuery
): Composition {
  const matched = filterByQuery(cards, q);

  const slots: ResolvedSlot[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  const resolveSlot = (capability: string, requesterLabel: string): void => {
    if (seen.has(capability)) return;
    seen.add(capability);
    const providers = matched.filter((c) => c.provides.includes(capability));
    if (providers.length === 0) {
      warnings.push(
        `unfilled slot: ${requesterLabel} requires '${capability}' but no card in the matched set provides it`
      );
      return;
    }
    slots.push({
      capability,
      fillerCard: providers[0]!.skill,
      candidates: providers.map((p) => p.skill),
    });
    if (providers.length > 1) {
      warnings.push(
        `multiple providers for '${capability}' (${requesterLabel}): [${providers.map((p) => p.skill).join(", ")}]. Picked '${providers[0]!.skill}' (alphabetical first). Use --card to override.`
      );
    }
  };

  for (const card of matched) {
    for (const req of card.requires) {
      resolveSlot(req, `card '${card.skill}'`);
    }
  }
  for (const card of matched) {
    for (const sName of card.deep.subagents) {
      const sub = subagents.find((s) => s.name === sName);
      if (!sub) {
        warnings.push(
          `subagent '${sName}' referenced by '${card.skill}' not found in skill-graph/subagents/`
        );
        continue;
      }
      for (const ref of sub.references) {
        resolveSlot(ref, `subagent '${sName}'`);
      }
    }
  }

  return { cards: matched, slots, warnings };
}

export interface ResolvedSubagent {
  name: string;
  model: string;
  prompt: string; // repo-relative path
  description: string;
  consumes: string[];
  emits: string[];
  references: string[];
}

export interface ResolvedRef {
  path: string; // repo-relative
  slot: string | null;
}

export interface ResolvedValidator {
  protocol?: string;
  module?: string;
  path: string; // repo-relative
}

export interface Manifest {
  modules: string[];
  core: string[];
  subagents: ResolvedSubagent[];
  refs: ResolvedRef[];
  validators: { protocol: ResolvedValidator[]; card: ResolvedValidator[] };
  emits: string[];
  consumes: string[];
  warnings: string[];
  slots: ResolvedSlot[];
}

function rel(repoRoot: string, absPath: string): string {
  return relative(repoRoot, absPath);
}

/**
 * Build a JSON manifest from a composition per SPEC-004.
 *
 * Output shape: { modules, core, subagents, refs, validators:{protocol,card},
 *   emits, consumes, warnings, slots }. All paths repo-relative.
 */
export function buildManifest(
  comp: Composition,
  subagents: Subagent[],
  protocols: ProtocolEntry[],
  repoRoot: string
): Manifest {
  // Aggregate emits/consumes across matched cards.
  const allEmits = new Set<string>();
  const allConsumes = new Set<string>();
  for (const c of comp.cards) {
    for (const p of c.emits) allEmits.add(p);
    for (const p of c.consumes) allConsumes.add(p);
  }

  // modules — skill names only.
  const modules = comp.cards.map((c) => c.skill);

  // subagents — deduped across cards; prompt is repo-relative.
  const subRefs: ResolvedSubagent[] = [];
  const seenSubs = new Set<string>();
  for (const c of comp.cards) {
    for (const sName of c.deep.subagents) {
      if (seenSubs.has(sName)) continue;
      seenSubs.add(sName);
      const sub = subagents.find((s) => s.name === sName);
      if (!sub) continue;
      subRefs.push({
        name: sub.name,
        model: sub.model,
        prompt: rel(repoRoot, sub.filePath),
        description: sub.description,
        consumes: sub.consumes,
        emits: sub.emits,
        references: sub.references,
      });
    }
  }

  // Route content per SPEC-tagen "Composition resolution algorithm" step 9.
  // Build cardSkill → fillerSlots[] from comp.slots; each matched card C goes
  // to exactly one bucket: non-filler → manifest.core[] (for core.files) and
  // manifest.refs[] with slot:null (for deep.refs); filler → all of C's
  // core.files ∪ deep.refs become refs[] entries tagged with each slot
  // capability C fills (one entry per (path, slot) pair).
  const fillerSlotsByCard = new Map<string, string[]>();
  for (const slot of comp.slots) {
    const list = fillerSlotsByCard.get(slot.fillerCard) ?? [];
    list.push(slot.capability);
    fillerSlotsByCard.set(slot.fillerCard, list);
  }

  const core: string[] = [];
  const refs: ResolvedRef[] = [];
  for (const c of comp.cards) {
    const brainPath = join(repoRoot, "brain", c.skill);
    const fillerSlots = fillerSlotsByCard.get(c.skill);
    if (!fillerSlots || fillerSlots.length === 0) {
      for (const f of c.core.files) core.push(rel(repoRoot, join(brainPath, f)));
      for (const r of c.deep.refs) {
        refs.push({ path: rel(repoRoot, join(brainPath, r)), slot: null });
      }
      continue;
    }
    const allPaths = [...c.core.files, ...c.deep.refs];
    for (const p of allPaths) {
      const repoRel = rel(repoRoot, join(brainPath, p));
      for (const cap of fillerSlots) {
        refs.push({ path: repoRel, slot: cap });
      }
    }
  }

  // validators.protocol — auto-derived from emits/consumes; only include
  // protocols that actually have a validator.ts on disk.
  const protocolValidators: ResolvedValidator[] = protocols
    .filter((p) => (allEmits.has(p.name) || allConsumes.has(p.name)) && p.hasValidator)
    .map((p) => ({
      protocol: p.name,
      path: rel(repoRoot, join(p.dirPath, "validator.ts")),
    }));

  // validators.card — union of every matched card's deep.validators.
  const cardValidators: ResolvedValidator[] = [];
  for (const c of comp.cards) {
    const brainPath = join(repoRoot, "brain", c.skill);
    for (const v of c.deep.validators) {
      cardValidators.push({
        module: c.skill,
        path: rel(repoRoot, join(brainPath, v)),
      });
    }
  }

  return {
    modules,
    core,
    subagents: subRefs,
    refs,
    validators: { protocol: protocolValidators, card: cardValidators },
    emits: [...allEmits].sort(),
    consumes: [...allConsumes].sort(),
    warnings: comp.warnings,
    slots: comp.slots,
  };
}
