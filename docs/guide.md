# tagen guide

Reference for commands, composition rules and validation. The full spec is
[specs/SPEC-tagen.md](specs/SPEC-tagen.md). The manifest contract is
[tagen-get-manifest.schema.json](tagen-get-manifest.schema.json).

## Card format

A card is a directory `brain/<type>/<name>/` with a `CORE.md`. The directory path is the
identity: type is the parent directory, name is the card directory. Frontmatter has no `type:`
or `name:`.

Five frontmatter fields exist: `description`, `aliases`, `requires`, `uses`, `subagents`.
Each type allows a fixed subset.

| Type | Allowed fields besides `description`, `aliases`, `requires` |
| --- | --- |
| `review`, `methodology` | `subagents` |
| `subagent` | `uses` |
| `lang`, `framework`, `test`, `architecture`, `protocol` | none |

A card may also have `references/*.md` (pulled on demand). Review and methodology cards may
have `validators/*.ts` and a `lib/` directory.

## Commands

| Command | Example | Description |
| --- | --- | --- |
| `list` | `tagen list` | List every card as `<type>/<name>` |
| `list` | `tagen list --type lang --aliases` | Filter to one type, show aliases |
| `search` | `tagen search worktree isolation` | Full-text fuzzy search, ranked by distinct query tokens matched |
| `validate` | `tagen validate` | Report every rule violation, exit non-zero on any |
| `get` | `tagen get strict csharp --json` | Resolve a composition into a JSON manifest |
| `get` | `tagen get methodology` | A bare type name browses that type |
| `get` | `tagen get strict csharp python --pin lang=python --json` | Override the alphabetical-first slot fill |
| `add` | `tagen add` | Interactive scaffold for a new card (the only writer) |

`--root <dir>` resolves the brain at `<dir>/brain` instead of walking up from the current
directory.

## How `tagen get` resolves

1. Fuzzy-match each positional argument to `<type>/<name>`. Minimum 3 characters. Order: exact,
   prefix, substring, Levenshtein.
2. Expand direct `uses: [<type>/<name>]` cards declared by the matched subagent cards.
3. Resolve `requires: [<type>]` slots over the expanded set. The alphabetically first
   candidate fills the slot. `--pin <type>=<name>` overrides.
4. Collect subagents declared by review and methodology cards, and their `validators/*.ts`.
5. Print a JSON manifest. All paths are relative to `root`.

An unfilled slot or an unmatched pin is a warning in the manifest, not a failure.

## What `tagen validate` checks

- Frontmatter fields against the per-type allowlist.
- Names are kebab-case.
- No harness-specific model names, lifecycle events, paths or commands under `brain/`.
  Narrow exceptions live in `.tagen/agnostic-guard.json`.
- A card body never names another card's `brain/<type>/<name>` path. Composition is declared in
  `uses:` and `requires:`.
- No symlinks under `brain/`.
- Protocol cards: schema, validator, and valid and invalid examples.

## As a dev dependency

```bash
bun add -d @questi0nm4rk/tagen
bunx tagen validate
bunx tagen get strict csharp --json
```
