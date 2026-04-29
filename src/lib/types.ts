export interface TagSet {
  phase: string[];
  domain: string[];
  language: string;
  layer: string;
  concerns: string[];
}

export interface SurfaceTier {
  triggers: string[];
}

export interface CoreTier {
  files: string[];
}

export interface DeepTier {
  subagents: string[];
  refs: string[];
  slots: Record<string, true>;
  validators: string[];
}

export interface CatalogCard {
  skill: string;
  plugin: string;
  /**
   * v1 field — kept for backward compat. v2 cards may omit this; module
   * root resolves by convention to brain/<skill>/ when absent.
   */
  source: string;
  tags: TagSet;
  /** v1 relationships — deprecated, kept so v1 cards still parse. */
  composes: string[];
  /** v1 relationships — deprecated. */
  enhances: string[];
  description: string;
  /** v1 summary field. Cards may use either iron_laws (v1) or summary (v2). */
  ironLaws: string[];
  /** v2 summary field. One line per iron law, short. */
  summary: string[];
  /** v2: capabilities this card provides to a composition. */
  provides: string[];
  /** v2: capabilities this card needs from the composition. */
  requires: string[];
  /** v2: protocols this card emits (outputs). */
  emits: string[];
  /** v2: protocols this card consumes (inputs). */
  consumes: string[];
  /** v2 tier 1 — discovery. */
  surface: SurfaceTier;
  /** v2 tier 2 — always loaded on activation. */
  core: CoreTier;
  /** v2 tier 3 — loaded for subagent dispatch. */
  deep: DeepTier;
  body: string;
  filePath: string;
}

export interface BuildQuery {
  tags: Partial<Record<keyof TagSet, string | string[]>>;
}

export interface BuildConfig {
  name: string;
  version: string;
  description: string;
  author: { name: string };
  keywords: string[];
  queries: BuildQuery[];
  include: string[];
  exclude: string[];
  hooks?: string;
}

export interface VocabularyDimension {
  description: string;
  order?: string[];
  values: Record<string, string>;
}

export interface Vocabulary {
  dimensions: Record<string, VocabularyDimension>;
  relationships: Record<string, string>;
}

export interface CapabilityRegistry {
  /** Map of capability name → optional description. */
  capabilities: Record<string, string>;
}

export interface ProtocolEntry {
  name: string;
  dirPath: string;
  hasSchema: boolean;
  hasDoc: boolean;
  hasValidator: boolean;
  hasValidExamples: boolean;
  hasInvalidExamples: boolean;
}

export type SubagentModel = "haiku" | "sonnet" | "opus";

export interface Subagent {
  name: string;
  /** Constrained to known model values; loader rejects unknown strings. */
  model: SubagentModel;
  description: string;
  consumes: string[];
  emits: string[];
  references: string[];
  body: string;
  filePath: string;
}

export interface ResolvedPath {
  filters: Record<string, string[]>;
  path: Array<{
    skill: string;
    layer: string;
    source: string;
    description: string;
    expanded: boolean;
  }>;
}
