<!-- markdownlint-disable MD013 -->

# SPEC-tagen — skill graph CLI

> Single spec. One source of truth. No versioning.

**Repo:** Questi0nM4rk/tagen
**npm:** `@questi0nm4rk/tagen`
**Consumers:** any project containing a `brain/` directory of typed cards.

---

## What tagen is

A read-only CLI that walks a `brain/` directory tree and emits per-task composition manifests. Cards are directories at `brain/<type>/<name>/`; each contains a `CORE.md` (always loaded) plus optional `references/` (pull-on-demand).

Tagen owns no methodology, writes no files (except `tagen add`), and has zero understanding of the content it serves. It walks the tree, parses frontmatter, fuzzy-matches positional arguments to cards, resolves `requires:` slots, and prints a JSON manifest.

---

## Problem statement / WHY

Agents writing code, reviewing PRs, or producing specs need composable per-task context. Without a query layer they're stuck with three bad options:

1. **Hardcode paths to specific cards.** Brittle — every rename breaks every methodology that referenced the file. No composition: a TDD methodology in C# has to copy-paste C# patterns into its own body.
2. **Load everything every time.** Context-cost explodes (a full catalog can run 50K+ tokens). Most of it is irrelevant to any given task. The agent pays for content it doesn't use.
3. **Re-derive composition at runtime in prose.** "I need TDD patterns AND C# idioms — let me describe both inline." Slow, lossy, no way to enforce that the composition is consistent across runs.

Tagen exists to make composition **declarative and cheap**:

- **Declarative**: a methodology card declares `requires: [lang]`. Tagen finds a card under `brain/lang/` to fill the slot. The methodology never names a specific language card; the user's query (or the agent's inference) picks one at composition time. Adding a new language is `mkdir brain/lang/<newlang>/` — methodologies that require `lang` automatically gain it as a candidate.
- **Cheap**: only `CORE.md` files load by default (small, dense, ≤300 lines). `references/` files are listed in the manifest but not loaded — the agent decides per-task which ones to pull. Progressive disclosure for free.
- **Safe**: query commands have no side effects. Agents can run `tagen get` freely while exploring; nothing on disk changes.

The dir tree IS the vocabulary because every alternative (YAML enum files, frontmatter `type:`/`name:` fields, capabilities.yaml registries) reduplicates information that the filesystem already encodes. Renames become `mv`; new types become `mkdir`; vocabulary stays in sync with reality without a separate maintenance loop.

---

## What tagen is NOT (deliberate non-features)

- **Not a build system.** No plugin assembly. No content generation. No `marketplace.json` generation.
- **Not a versioner.** Card names, type names, alias names, protocol names — all rewritten in place. No `@v1` suffixes. No migration shims.
- **Not an auto-resolver.** Tagen never pulls transitive `requires:` from outside the user-specified matched set. It warns; the agent decides whether to broaden.
- **Not a writer.** `tagen get`, `tagen list`, `tagen validate` all read-only. Only `tagen add` writes.
- **Not a tag system.** No `tags:`, no `provides:`, no `capabilities.yaml`, no `vocabulary.yaml`. The directory tree is the entire vocabulary.
- **Not aware of installed tools at all.** Tools live in `tools/`. That's Claude Code's concern. Tagen never opens `plugin.json` — its schema is Anthropic's, not tagen's, and tagen has nothing to add to it.

---

## Iron Laws

Each law has a **WHY** that names the failure mode it prevents.

1. **The directory tree is the vocabulary.**
   WHY: Adding a new type = `mkdir brain/<newtype>/`. Adding a new card = `mkdir brain/<type>/<name>/`. Renames are `mv`. No YAML files to keep in sync with reality.

2. **Every card is a directory; every card has a `CORE.md`.**
   WHY: One predictable shape. `tagen list` walks one pattern. Validate is a falsifiable check ("does the dir exist? does CORE.md exist?").

3. **`CORE.md` is short and dense (≤ 300 lines).**
   WHY: It loads into every composition that pulls this card. Bloat inflates context cost. Long-form is opt-in via `references/`.

4. **Type = parent dir, name = card dir. No `type:` or `name:` in frontmatter.**
   WHY: Filesystem provides the taxonomy; nothing to typo. Identity is the path.

5. **`requires:` lists type names (= dir names under `brain/`).**
   WHY: A methodology declaring `requires: [lang]` says "I need a card from `brain/lang/` in the matched composition". One concept, one place.

6. **Aliases live in the canonical card's frontmatter and are globally unique.**
   WHY: Colocated with the canonical name. Globally unique guarantees fuzzy resolution lands on exactly one card.

7. **References are pull-on-demand.**
   WHY: Manifest lists them; agent decides per-task. Always-loading defeats progressive disclosure.

8. **Tagen validates, agent resolves.**
   WHY: Tagen sees only the dir tree and frontmatter. The agent sees full task context. Auto-resolution pulls modules the user didn't ask for; manual resolution lets the smarter system decide.

9. **Slot conflict: alphabetical first wins.**
   WHY: Deterministic, cheap, predictable across machines. Agent overrides with explicit `--pin <type>=<name>` when the default is wrong.

10. **No versioning anywhere.**
    WHY: Single-maintainer closed catalog. Renames in place; all references updated in one PR. Versioning pays for external consumers we don't have.

11. **Tagen is offline.**
    WHY: No network, no auth, no telemetry. Operates on local files. Safe for any environment.

12. **Read-only by default.** Only `tagen add` writes.
    WHY: Query commands are safe to run repeatedly. Agents can compose freely without worrying about disk mutation.

---

## Layout (what tagen reads)

```
brain/
├── review/<name>/                  # CORE.md, references/, validators/, lib/
├── methodology/<name>/             # CORE.md, references/, validators/ (optional), lib/
├── lang/<name>/                    # CORE.md, references/
├── framework/<name>/               # CORE.md, references/
├── test/<name>/                    # CORE.md, references/
├── architecture/<name>/            # CORE.md, references/
├── subagent/<name>/                # CORE.md (frontmatter has model: haiku|sonnet|opus)
└── protocol/<name>/                # CORE.md, schema.json, validator.ts, examples/{valid,invalid}/
                                    # (protocol cards self-check at validate time;
                                    #  no other card references them.)
```

`tools/` is not part of what tagen reads. Tagen ignores anything outside `brain/`.

### Discovery

`findBrainDir()` walks up from `process.cwd()` up to 10 parent directories looking for a `brain/` directory containing at least one subdirectory with at least one card directory containing a `CORE.md`. The first match wins. Errors with a clear message if not found.

### Card structure

Every card directory contains:

| Path | Required | Notes |
|------|----------|-------|
| `CORE.md` | yes | Frontmatter + body. Always loaded. ≤ 300 lines. |
| `references/<topic>.md` | optional | Pull-on-demand long-form content. Tagen lists their paths in the manifest; does not load them. |
| `validators/<rule>.ts` | optional (review/methodology) | Card-level validators. stdin = JSON, exit 0 = pass, exit 1 + stderr = violations. |
| `lib/<file>.ts` | optional (review/methodology) | Shared TypeScript modules used by the card's validators. Tagen never reads `lib/`; it just doesn't reject it. |
| `schema.json` | required (protocol) | JSON Schema (draft-07+). Defines the wire format the card documents. |
| `validator.ts` | required (protocol) | Used by `tagen validate` to confirm each example matches its expected verdict. Not invoked at composition time. |
| `examples/valid/*.json` | required (protocol, ≥1) | MUST validate against `schema.json`. |
| `examples/invalid/*.json` | required (protocol, ≥1) | MUST fail validation against `schema.json`. |

Empty `references/` directories are allowed. Tagen does not hide them.

---

## CORE.md frontmatter

```yaml
---
description: "One-line summary. Required."
aliases: [dotnet]                  # optional; query-time alternate names; globally unique
requires: [lang]                   # optional; type names this card needs slot-filled
subagents: [security-reviewer]     # review/methodology only; names of subagents this card dispatches
model: sonnet                      # subagent only; haiku | sonnet | opus
---

# Body — short and dense. Orchestration of subagents (order, parallel/sequential,
# what input each one gets) is described here in prose; the frontmatter array
# just lists which subagents this card uses.
```

Five fields total: `description`, `aliases`, `requires`, `subagents`, `model`. Anything else in frontmatter is rejected by `tagen validate`.

---

## Commands

Four commands. All read-only except `tagen add`.

### `tagen get <args>`

The composition entry point. Fuzzy-matches positional arguments to cards, resolves `requires:` slots, emits a JSON manifest to stdout.

```
tagen get [args...] [--type T --name N]... [--pin <type>=<name>]... [--json] [--dry-run]
```

- `args` (positional, repeatable): each arg is fuzzy-matched against canonical names + aliases. Minimum 3 characters per arg.
- `--type T --name N` (paired flags, repeatable): explicit `(type, name)` selection. Bypasses fuzzy matching for these pairs.
- `--pin <type>=<name>` (repeatable): force a specific card to fill a given slot. Overrides alphabetical-first slot resolution.
- `--json` (default true): output JSON to stdout.
- No args → print help, exit 0.

Exit codes: 0 (manifest emitted, warnings allowed), 1 (validation error), 2 (no matches).

### `tagen list`

Browse the catalog. By default lists every card as `<type>/<name>`. With `--aliases`, prints each card's aliases beside its canonical name.

```
tagen list [--type T] [--aliases] [--json]
```

- `--type T`: list only cards under `brain/<T>/`.
- `--aliases`: include aliases for each card. Text mode prints `<type>/<name>  (alias1, alias2)`. JSON mode adds `aliases: string[]` to each entry.
- `--json`: machine-readable output.

Exit codes: 0 (success), 1 (validation error reading the tree).

### `tagen validate`

Walk the tree. Check every rule (see Validate rules below). Print all violations. Exit non-zero on any failure.

```
tagen validate [--verbose]
```

- `--verbose`: per-card per-rule trace.

Exit codes: 0 (clean), 1 (violations), 2 (brain/ not found).

### `tagen add`

Interactive scaffold for a new card. Prompts for type, name, description, then type-appropriate optional fields (`aliases`, `requires`, `subagents` on review/methodology, `model` on subagent). Creates `brain/<type>/<name>/CORE.md` with the frontmatter, plus an empty `references/` directory.

```
tagen add
```

Exit codes: 0 (written), 1 (aborted or validation error).

---

## Fuzzy matching

Used by `tagen get` to resolve positional args to cards.

- **Minimum 3 characters per arg.** Args with fewer than 3 characters are rejected with an explicit error.
- **Match space:** for each card, the canonical name + every alias.
- **Algorithm:** case-insensitive substring match with Levenshtein-distance tie-break. Prefer exact > prefix > substring > Levenshtein.
- **Per-arg single result:** each positional arg resolves to at most one `(type, name)` pair. If multiple cards score equally, error: "ambiguous arg `<X>`: matches `<list>`. Use --type/--name or rename."
- **Cross-type:** an arg may match cards under different types (e.g. `dotnet` matches `lang/csharp` via alias AND `framework/dotnet10` via canonical name). Tagen surfaces both candidates and asks the user to disambiguate via explicit `--type T --name N` flags.
- **No fuzzy on type-only args.** A bare `methodology` (matching the type dir name) is interpreted as a "browse" intent: lists cards under that type without composing.

---

## Resolution algorithm

Used by `tagen get`.

```
1. Walk brain/ — build (type, name) → card-dir index. Read each CORE.md frontmatter.
2. Build alias index — every alias maps to its canonical (type, name). Detect collisions.
3. Parse args:
     - Each positional arg → fuzzy-match to (type, name).
     - --type T --name N pairs → exact (type, name).
     - --pin <type>=<name> → recorded for slot resolution.
   Sort matched set alphabetically by (type, name).
4. Collect requires from matched set: union of all `requires:` arrays.
5. For each required type T:
     candidates = matched cards under brain/T/
     pinned = cards in candidates whose name == --pin T=<name> (if any --pin T=… was given)
     if pinned: chosen = pinned[0]
     elif candidates: chosen = candidates[0]   (alphabetical first)
     else: warning "unfilled slot for type T"
     append { type: T, fillerCard: chosen.name, candidates: candidates.names } to slots[]
     if len(candidates) > 1: warning "multiple candidates for type T: <list>. Picked <chosen>. Use --pin T=<name> to override."
6. For each card in matched set: resolve its references:
     for each file under <card-dir>/references/<topic>.md:
       append to that card's references[] list in the manifest
7. Resolve subagents: for every review/methodology card in the matched set, read its
   `subagents:` frontmatter array. Union the names across cards. For each name, resolve to
   `brain/subagent/<name>/CORE.md`. If a name doesn't resolve, warning "unknown subagent: <name>
   referenced by <card>".
8. Resolve card validators: for review/methodology cards in the matched set,
   list <card-dir>/validators/*.ts.
9. Set `root` = the absolute path of the marketplace dir tagen discovered.
10. Assemble manifest with all paths root-relative (see contract below).
11. Output JSON to stdout. Warnings to stderr.
12. Exit 0 (warnings ok), 1 (validation error), 2 (no matches).
```

---

## Manifest JSON contract

The output of `tagen get`. **Stable contract** — breaking changes need a dedicated PR with consumer updates in lockstep.

All paths in the manifest are relative to the top-level `root` field — the absolute path of the marketplace directory tagen discovered. The agent resolves any path with `root + "/" + path`. This makes the manifest dir-agnostic: the same card content works regardless of where the marketplace lives on disk.

```json
{
  "root": "/home/user/Projects/qsm-marketplace",
  "modules": [
    { "type": "review", "name": "strict", "core": "brain/review/strict/CORE.md" },
    { "type": "lang",   "name": "csharp", "core": "brain/lang/csharp/CORE.md" }
  ],
  "core": [
    "brain/review/strict/CORE.md"
  ],
  "references": [
    "brain/review/strict/references/workflow.md",
    "brain/review/strict/references/iron-laws.md",
    "brain/review/strict/references/output-format.md"
  ],
  "filled": {
    "lang": {
      "core": "brain/lang/csharp/CORE.md",
      "references": [
        "brain/lang/csharp/references/async.md",
        "brain/lang/csharp/references/linq.md",
        "brain/lang/csharp/references/nullability.md"
      ]
    }
  },
  "slots": [
    {
      "type": "lang",
      "fillerCard": "csharp",
      "candidates": ["csharp"]
    }
  ],
  "subagents": [
    "brain/subagent/ai-slop-researcher/CORE.md",
    "brain/subagent/review-suggestion-researcher/CORE.md",
    "brain/subagent/security-reviewer/CORE.md",
    "brain/subagent/architecture-reviewer/CORE.md",
    "brain/subagent/review-validator/CORE.md"
  ],
  "validators": [
    "brain/review/strict/validators/no-emoji.ts",
    "brain/review/strict/validators/imperative-mood.ts",
    "brain/review/strict/validators/no-severity-labels.ts"
  ],
  "warnings": []
}
```

### Field meanings

| Field | Type | Notes |
|-------|------|-------|
| `root` | string | Absolute path of the marketplace dir. All other paths are relative to this. |
| `modules` | array | Every card in the matched set, with `type` / `name` / `core` path. |
| `core` | string[] | CORE.md paths from non-filler cards (methodologies, not slot fillers). Agent loads these immediately. |
| `references` | string[] | Reference file paths from non-filler cards. Pull-on-demand; agent reads them only if the task warrants it. |
| `filled` | object keyed by type | One entry per slot the methodology required. Each entry has `core` (load immediately) and `references` (pull-on-demand). |
| `slots` | array | Slot resolution metadata: type, chosen filler, all candidates. |
| `subagents` | string[] | Paths to CORE.md files of subagents the matched methodology dispatches. Agent reads each subagent's CORE.md for its `model:` (which Claude tier to invoke) and body (role + how the methodology calls it). The methodology's CORE.md owns dispatch orchestration. |
| `validators` | string[] | Paths to card-level validator scripts on review/methodology cards. The methodology decides when and what to pipe through them. |
| `warnings` | string[] | Non-fatal composition warnings. |

The manifest schema lives at `docs/tagen-get-manifest.schema.json` and is enforced by a CI test on every PR.

### How the agent reads it

1. Resolve every path with `root + "/" + <path>`.
2. Load `core[]` files immediately (the methodology body — orchestration of subagents lives here).
3. For each entry in `filled{}`: load `core` immediately. Decide per-task which `references` to pull.
4. The methodology's CORE.md tells the agent **how** to dispatch each subagent in `subagents[]` (order, parallel vs sequential, what input to pass). The manifest just lists which subagent files to consult; tagen does not encode orchestration.
5. Dispatch a subagent by reading its CORE.md (frontmatter `model:` for which Claude tier to invoke; body for the role and how the methodology calls it) and invoking it with the input the methodology specifies.
6. The methodology's CORE.md says when (and whether) to run any of the scripts in `validators[]` against its outputs.
7. Read `warnings[]` first; decide whether to proceed partial or abort.

---

## Validate rules

`tagen validate` runs every check. Errors print to stderr; non-zero exit on any failure.

### Filesystem rules

| Rule | Error |
|------|-------|
| Card path is not a directory | `<path>: card must be a directory, not a file` |
| Missing `CORE.md` | `<type>/<name>: missing CORE.md` |
| `CORE.md` is not a file | `<type>/<name>/CORE.md: must be a file` |
| `CORE.md` ≥ 300 lines (excluding frontmatter) | `<type>/<name>/CORE.md: exceeds 300 lines (got <N>); move overflow into references/` |
| Card dir name not lowercase kebab-case | `<type>/<name>: card name must match [a-z][a-z0-9-]*` |
| Type dir name not lowercase | `<type>: type name must match [a-z][a-z0-9-]*` |

### Frontmatter rules

| Rule | Error |
|------|-------|
| Missing `---` markers | `<card>: CORE.md missing YAML frontmatter` |
| Frontmatter is not valid YAML | `<card>: CORE.md frontmatter parse error: <msg>` |
| Missing required field `description` | `<card>: missing required frontmatter field: description` |
| Unknown frontmatter field | `<card>: unknown frontmatter field: <key>` |
| Field is wrong type (e.g. `aliases:` is not an array) | `<card>: <field> must be <expected type>` |

### Reference rules

| Rule | Error |
|------|-------|
| `requires:` value not a known type (no matching `brain/<value>/` dir) | `<card>: unknown type in requires: <value>` |
| `subagents:` value not a known subagent (no `brain/subagent/<value>/CORE.md`) | `<card>: unknown subagent in subagents: <value>` |
| `subagents:` declared on a card outside `brain/review/` or `brain/methodology/` | `<card>: subagents allowed only on review and methodology cards` |

### Alias rules

| Rule | Error |
|------|-------|
| Alias collision (same alias on two cards) | `<alias>: collides between <card-a> and <card-b>` |
| Alias matches a canonical name | `<alias>: collides with canonical name <type>/<name>` |
| Alias is not a string | `<card>: aliases must be an array of strings` |

### Subagent rules

| Rule | Error |
|------|-------|
| Subagent missing `model:` frontmatter | `subagent/<name>: missing required field: model` |
| Subagent `model:` not in [haiku, sonnet, opus] | `subagent/<name>: unknown model: <value>` |

### Protocol rules

| Rule | Error |
|------|-------|
| Missing `schema.json` | `protocol/<name>: missing schema.json` |
| Missing `validator.ts` | `protocol/<name>: missing validator.ts` |
| `validator.ts` not executable | `protocol/<name>: validator.ts not executable` |
| Missing `examples/valid/` or `examples/invalid/` directory | `protocol/<name>: missing examples/<dir>` |
| `examples/valid/` or `examples/invalid/` empty | `protocol/<name>: examples/<dir> must contain at least one .json payload` |
| Valid example fails schema (ajv) | `protocol/<name>: examples/valid/<file> fails schema` |
| Invalid example passes schema | `protocol/<name>: examples/invalid/<file> passes schema (should fail)` |

### Validator rules

| Rule | Error |
|------|-------|
| Card validator (`<card>/validators/*.ts`) not executable | `<card>: validator <file> not executable` |
| Validator declared on non-review/non-methodology card | `<card>: validators/ allowed only on review and methodology cards` |

`tagen validate` always runs ALL checks; never fails fast. Prints all violations before exiting.

---

## TypeScript types (implementation contract)

These types live in `src/lib/types.ts` and form the contract between loaders, composer, and command layers.

```ts
export type CardType = string;     // dir name under brain/

export interface CardId {
  type: CardType;
  name: string;
}

export interface CardFrontmatter {
  description: string;
  aliases?: string[];
  requires?: CardType[];
  subagents?: string[];                  // review/methodology only
  model?: "haiku" | "sonnet" | "opus";   // subagent only
}

export interface Card {
  id: CardId;
  dirPath: string;                  // <root>/brain/<type>/<name>/
  corePath: string;                 // <root>/brain/<type>/<name>/CORE.md
  frontmatter: CardFrontmatter;
  body: string;
  references: string[];             // brain/<type>/<name>/references/*.md (root-relative)
  validators: string[];             // brain/<type>/<name>/validators/*.ts (root-relative)
}

export interface Protocol extends Card {
  schemaPath: string;
  validatorPath: string;
  validExamples: string[];
  invalidExamples: string[];
}

export interface ResolvedSlot {
  type: CardType;
  fillerCard: string;               // chosen card's name
  candidates: string[];             // all candidates' names (alphabetical)
}

export interface FilledSlot {
  core: string;                     // root-relative
  references: string[];             // root-relative
}

export interface Manifest {
  /** Absolute path of the marketplace dir. All other paths in the manifest are relative to this. */
  root: string;
  modules: Array<CardId & { core: string }>;
  core: string[];                                // root-relative
  references: string[];                          // root-relative
  filled: Record<CardType, FilledSlot>;
  slots: ResolvedSlot[];
  subagents: string[];                           // paths to brain/subagent/<name>/CORE.md (root-relative)
  validators: string[];                          // root-relative paths to review/methodology card validators
  warnings: string[];
}
```

---

## Distribution

Two install paths, same source.

| Path | Build command | Runtime requirement |
|------|---------------|----------------------|
| npm devDep / global | `bun build src/main.ts --target=bun --outfile=bin/tagen.js` | Bun |
| Standalone binary | `bun build src/main.ts --compile --outfile=bin/tagen` | None — self-contained binary |

`package.json` exports the CLI and a stable subpath for the validator runtime:

```json
{
  "name": "@questi0nm4rk/tagen",
  "bin": { "tagen": "./bin/tagen.js" },
  "exports": {
    ".": { "types": "./dist/main.d.ts", "default": "./bin/tagen.js" },
    "./validator-runtime": {
      "types": "./dist/validator-runtime.d.ts",
      "default": "./dist/validator-runtime.js"
    }
  },
  "files": ["bin/", "dist/"]
}
```

### `@questi0nm4rk/tagen/validator-runtime`

Tiny zero-dep helper for card validators. stdin = JSON, exit 0 = pass, exit 1 + stderr lines = violations.

```ts
import { readPayload, pass, fail } from "@questi0nm4rk/tagen/validator-runtime";

const artifact = await readPayload<{ body: string }>();
const hits: string[] = [];
if (/\b(critical|major)\b/i.test(artifact.body)) hits.push("severity label in body");
hits.length ? fail(hits) : pass();
```

API:

```ts
export function readPayload<T = unknown>(): Promise<T>;
export function pass(): never;                          // exit 0
export function fail(violations: string[] | string): never;  // exit 1
```

### Dependencies

| Package | Type | Purpose |
|---------|------|---------|
| `yaml` | prod | Parse YAML frontmatter |
| `ajv` | prod | Self-check protocol cards' examples against `schema.json` during `tagen validate` |
| `@questi0nm4rk/feats` | dev | BDD framework |
| `bun` | dev | Runtime + bundler + test runner |

Only `tagen validate` invokes `ajv`; the other commands never load it.

---

## Testing strategy

- **Unit tests** (`__tests__/*.test.ts`): card loader (walks `brain/`), frontmatter parser, fuzzy matcher, slot resolver, manifest assembler. Fixtures in `__tests__/fixtures/brain/`.
- **Manifest contract test**: `tagen get --json` output validated against `docs/tagen-get-manifest.schema.json`. Breaking changes block merge.
- **BDD scenarios** (`features/*.feature`): one per command. End-to-end on the fixture brain dir.
- **Validate fixture tests**: known-bad fixture brain dirs exercise each error class; assert exit code + error message.
- **Performance**: `tagen get` < 500ms on a 100-card fixture. Regression blocks merge.
- **No self-review.** External tools only — biome, bun:test, feats, ajv schema validation.

---

## Operational readiness

### Install

```bash
bun add -g @questi0nm4rk/tagen          # global, invoke as `tagen <cmd>`
bun add -D @questi0nm4rk/tagen          # devDep, invoke via `bunx tagen`
# or download the standalone binary from GitHub Releases
```

### First-run sanity

```bash
tagen list          # prints every <type>/<name> in the discovered brain/ tree
tagen list --aliases # same, with each card's aliases
tagen validate      # exit 0 on a clean tree
```

### CI integration

```bash
bunx tagen validate
```

One job, fast on a 60-card catalog. Non-zero exit blocks merge.

### Contributor workflow (adding a card)

1. `mkdir brain/<type>/<name>/`
2. Write `brain/<type>/<name>/CORE.md` with frontmatter + body ≤ 300 lines.
3. (Optional) Add `references/<topic>.md` for overflow.
4. (Methodology / review) Add `validators/<rule>.ts` if needed.
5. (Protocol) Add `schema.json`, `validator.ts`, `examples/valid/*.json`, `examples/invalid/*.json`.
6. `tagen validate` — fix violations.
7. `tagen get --type <T> --name <N>` (or `tagen get <fuzzy-match>`) — verify composition.
8. Commit.

### Agent workflow (typical task)

1. `tagen get review dotnet` (or whatever positional args fit the task) — get the manifest.
2. Load `core[]` files immediately.
3. For each `filled{}` entry: load its `core` immediately; decide per-task which `references` to pull.
4. Dispatch `subagents[]` per the methodology's CORE.md instructions (it owns order, parallelism, and what each subagent gets as input).
5. The methodology decides when to run any of the scripts in `validators[]` against its outputs.
6. Read `warnings[]` first; decide whether to proceed.

### Diagnostics

- `tagen validate --verbose` — per-card per-rule trace.
- `tagen list --type <T>` — browse one type.
- `tagen list --aliases` — include each card's aliases beside its canonical name.

### Error reporting

All errors print to stderr with a `tagen:` prefix. Exit 0 = success, 1 = user error or validation failure, 2 = no matches / brain not found.

### Recovery

The `brain/` tree is git-tracked. `git revert` undoes a bad addition. Tagen has no persistent state.

---

## Decisions & trade-offs

Each row: chose **X** over **Y** because **Z**. The Z is what tagen would lose if the decision flipped.

| Chose | Over | Because |
|-------|------|---------|
| Directory tree as vocabulary | YAML enum files (`capabilities.yaml`, `types.yaml`, `vocabulary.yaml`) | One source of truth — the filesystem. Renames are `mv`, new types are `mkdir`. No second-system drift between vocab file and reality on disk. |
| `CORE.md` always loaded; `references/` opt-in | Whole-card load on match | Predictable context cost per matched card. Long-form opt-in lets the agent pay only for what the task needs. |
| Single `(type, name)` per card | Multi-typed cards via `provides: [a, b]` arrays | Forces atomicity. If a card spans two types, split it into two cards. Simpler matching, no "which type wins" decision. |
| Fuzzy positional args | Required `--type T --name N` flags | Agent ergonomics: `tagen get review dotnet` beats `tagen get --type review --name strict --type lang --name csharp`. Explicit flags coexist for disambiguation. |
| 3-character minimum on fuzzy match | No minimum | Prevents accidental matches on 1-2 char substrings (`c` would otherwise hit `csharp`, `cpp`, `c`, `cli`). |
| Alphabetical-first slot resolution | Most-specific / first-declared / random | Deterministic across machines. Cheap. Agent overrides with `--pin <type>=<name>` when wrong. |
| Aliases in card frontmatter | Separate `aliases.yaml` / symlinks | Colocated with the canonical card; one place to look when debugging. Symlinks break on Windows and confuse git diffs; separate YAML drifts. |
| Read-only by default; only `tagen add` writes | All commands writable | Agents can run query commands repeatedly without disk-mutation risk. Side effects are isolated to one explicit command. |
| No versioning anywhere | `@v1` suffixes / migration shims / parallel old+new | Single-maintainer closed catalog. Renames in place; one PR updates every reference. Versioning pays only for external consumers we don't have. |
| No transitive auto-resolution of `requires:` | Auto-pull cards from outside the matched set | Tagen sees only the dir tree and frontmatter. The agent sees task context. Auto-pulling drags in modules the user didn't ask for; manual resolution lets the smarter system decide. |
| Hand-maintained `marketplace.json` | Generated from `tools/*/plugin.json` | 15–20 tool plugins; listing by hand is trivial. Generation introduces drift, race conditions, and a build step that can fail. |
| `yaml` as only runtime dep | Adding `ajv`, `chalk`, `commander`, etc. | Tagen is offline and minimal. Schema validation is the consuming marketplace's dep, not tagen's. CLI argument parsing is small enough to write by hand. |
| Tools live in `tools/`, not `brain/` | Folding installable plugins into `brain/` | Installable CC plugins are a different concern from compose-into-methodology content. `brain/` is read by tagen at composition time; `tools/` is read by Claude Code at install time. Two readers, two roots. |
| `tagen add` is interactive | Non-interactive `tagen add <type> <name>` flag form | Interactive prompts catch missing required fields with clear messages. Scripted creation is a niche need; trivial to add later if real users want it. |
| Bun-native runtime | Node-portable | Bun is the project default; compiled binary covers the no-Bun case. Maintaining two runtimes doubles testing surface. |
| Manifest emitted to stdout | Manifest written to a file | Stdout is composable: `tagen get ... \| jq`, `tagen get ... \| my-loader`. Files would create cleanup state. |

---

## Open questions

- Should `tagen get` accept positional `<type>/<name>` syntax (e.g. `tagen get review/strict lang/csharp`) as an alternative to fuzzy matching? Lower priority; explicit `--type T --name N` already covers it.
- Should there be a `tagen get --module <type>/<name>` shortcut to grab one card + its slot fills without positional fuzzy resolution? Defer until an agent asks for it.
