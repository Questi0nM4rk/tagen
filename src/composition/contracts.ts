import type { CardId, CardType, Manifest } from "../lib/types.ts";

export interface ComposeQuery {
  /** Free-form positional args fuzzy-matched to cards. */
  readonly positional: readonly string[];
  /** Explicit (type, name) selections, paired and repeatable. */
  readonly explicit: readonly CardId[];
  /** `--pin <type>=<name>` overrides for slot filling. */
  readonly pins: ReadonlyMap<CardType, string>;
}

export interface ComposeOutcome {
  readonly manifest?: Manifest;
  /** Errors that prevent producing a manifest (ambiguous fuzzy match, etc.). */
  readonly errors: readonly string[];
  /** Browse intent triggered: a positional arg matched a type dir name. */
  readonly browseTypes: readonly CardType[];
  /** Composition was attempted but no cards matched (exit-2 case). */
  readonly emptyMatch: boolean;
}
