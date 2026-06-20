/**
 * Implementation contract per SPEC-tagen.
 *
 * Card identity is the dir path: type = parent dir name, name = card dir name.
 * Frontmatter carries no `type:` or `name:` — the filesystem is the taxonomy.
 */
import { ImmutableMap } from "./immutable-collections.ts";

export type CardType = string;

export interface CardId {
  readonly type: CardType;
  readonly name: string;
}

/** Canonical "<type>/<name>" key used by every index, error message, and CLI output. */
export function cardKey(id: CardId): string {
  return `${id.type}/${id.name}`;
}

/** Type and card dir names must match this — enforced by `tagen validate`. */
export const KEBAB_NAME = /^[a-z][a-z0-9-]*$/;

const SUBAGENT_HOST_TYPES = new Set<CardType>(["review", "methodology"]);

/** Whether a card type may declare `subagents:` and ship `validators/`. */
export function isSubagentHostType(type: CardType): boolean {
  return SUBAGENT_HOST_TYPES.has(type);
}

export interface CardFrontmatter {
  readonly description: string;
  readonly aliases?: readonly string[];
  readonly requires?: readonly CardType[];
  /** subagent only; canonical `<type>/<name>` card IDs */
  readonly uses?: readonly string[];
  /** review/methodology only */
  readonly subagents?: readonly string[];
}

export interface Card {
  readonly id: CardId;
  /** Absolute dir path: <root>/brain/<type>/<name>/ */
  readonly dirPath: string;
  /** Absolute path to CORE.md */
  readonly corePath: string;
  readonly frontmatter: CardFrontmatter;
  readonly body: string;
  /** Root-relative paths to references/*.md */
  readonly references: readonly string[];
  /** Root-relative paths to validators/*.ts (review/methodology only) */
  readonly validators: readonly string[];
}

export interface Protocol extends Card {
  /** Root-relative path to schema.json */
  readonly schemaPath: string;
  /** Root-relative path to validator.ts */
  readonly validatorPath: string;
  /** Root-relative paths to examples/valid/*.json */
  readonly validExamples: readonly string[];
  /** Root-relative paths to examples/invalid/*.json */
  readonly invalidExamples: readonly string[];
}

export interface ResolvedSlot {
  readonly type: CardType;
  readonly fillerCard: string;
  /** Alphabetical names of all candidates */
  readonly candidates: readonly string[];
}

export interface FilledSlot {
  /** Root-relative path */
  readonly core: string;
  /** Root-relative paths */
  readonly references: readonly string[];
}

/** Index a card list by `<type>/<name>` for O(1) lookup. */
export function cardIndex(cards: readonly Card[]): ReadonlyMap<string, Card> {
  return new ImmutableMap(cards.map((c) => [cardKey(c.id), c] as const));
}

export interface Manifest {
  /** Absolute path of the marketplace dir. All other paths are relative to this. */
  readonly root: string;
  readonly modules: readonly (CardId & { readonly core: string })[];
  /** Root-relative paths from non-filler cards */
  readonly core: readonly string[];
  /** Root-relative paths from non-filler cards */
  readonly references: readonly string[];
  readonly filled: Readonly<Record<CardType, FilledSlot>>;
  readonly slots: readonly ResolvedSlot[];
  /** Root-relative paths to brain/subagent/<name>/CORE.md */
  readonly subagents: readonly string[];
  /** Root-relative paths to review/methodology card validators */
  readonly validators: readonly string[];
  readonly warnings: readonly string[];
}
