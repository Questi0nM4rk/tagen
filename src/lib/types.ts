/**
 * Implementation contract per SPEC-tagen.
 *
 * Card identity is the dir path: type = parent dir name, name = card dir name.
 * Frontmatter carries no `type:` or `name:` — the filesystem is the taxonomy.
 */

export type CardType = string;

export interface CardId {
  type: CardType;
  name: string;
}

/** Canonical "<type>/<name>" key used by every index, error message, and CLI output. */
export function cardKey(id: CardId): string {
  return `${id.type}/${id.name}`;
}

/** Type and card dir names must match this — enforced by `tagen validate`. */
export const KEBAB_NAME = /^[a-z][a-z0-9-]*$/;

/** Card types allowed to declare `subagents:` and ship `validators/`. */
export const SUBAGENT_HOST_TYPES: ReadonlySet<CardType> = new Set([
  "review",
  "methodology",
]);

export interface CardFrontmatter {
  description: string;
  aliases?: string[];
  requires?: CardType[];
  /** review/methodology only */
  subagents?: string[];
  /** subagent only */
  model?: "haiku" | "sonnet" | "opus";
}

export interface Card {
  id: CardId;
  /** Absolute dir path: <root>/brain/<type>/<name>/ */
  dirPath: string;
  /** Absolute path to CORE.md */
  corePath: string;
  frontmatter: CardFrontmatter;
  body: string;
  /** Root-relative paths to references/*.md */
  references: string[];
  /** Root-relative paths to validators/*.ts (review/methodology only) */
  validators: string[];
}

export interface Protocol extends Card {
  /** Root-relative path to schema.json */
  schemaPath: string;
  /** Root-relative path to validator.ts */
  validatorPath: string;
  /** Root-relative paths to examples/valid/*.json */
  validExamples: string[];
  /** Root-relative paths to examples/invalid/*.json */
  invalidExamples: string[];
}

export interface ResolvedSlot {
  type: CardType;
  fillerCard: string;
  /** Alphabetical names of all candidates */
  candidates: string[];
}

export interface FilledSlot {
  /** Root-relative path */
  core: string;
  /** Root-relative paths */
  references: string[];
}

export interface Manifest {
  /** Absolute path of the marketplace dir. All other paths are relative to this. */
  root: string;
  modules: Array<CardId & { core: string }>;
  /** Root-relative paths from non-filler cards */
  core: string[];
  /** Root-relative paths from non-filler cards */
  references: string[];
  filled: Record<CardType, FilledSlot>;
  slots: ResolvedSlot[];
  /** Root-relative paths to brain/subagent/<name>/CORE.md */
  subagents: string[];
  /** Root-relative paths to review/methodology card validators */
  validators: string[];
  warnings: string[];
}
