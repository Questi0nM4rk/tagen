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
  description: string;
  summary: string[];
  tags: TagSet;
  provides: string[];
  requires: string[];
  emits: string[];
  consumes: string[];
  surface: SurfaceTier;
  core: CoreTier;
  deep: DeepTier;
  body: string;
  filePath: string;
  /**
   * Legacy v1 frontmatter keys present in the file. Empty for clean v2 cards.
   * Populated by parseCard; consumed by `tagen validate` to hard-error per
   * SPEC-tagen Legacy field rejection. Not part of the manifest contract.
   */
  legacyFields: string[];
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
