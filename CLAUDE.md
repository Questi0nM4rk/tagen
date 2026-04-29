# CLAUDE.md — tagen

Standalone read-only CLI for the qsm-marketplace skill-graph.
Reads catalog cards, vocabulary, capabilities, protocols, and subagents from a calling project's
`skill-graph/` directory and emits a JSON manifest naming everything the agent should load for a tag query.

Spec: `docs/specs/SPEC-tagen.md`. Manifest contract: `docs/tagen-get-manifest.schema.json`.

---

## Commands

| Command | Description |
|---------|-------------|
| `tagen tags` | Print controlled vocabulary (tags + capabilities + protocols + subagents) |
| `tagen validate` | Validate all cards, protocols, and subagents; non-zero exit on any error |
| `tagen list` | List catalog cards; `--filter key=value` for tag filtering |
| `tagen demo` | Preview a composition (matched cards + slot fills + warnings) |
| `tagen get` | Resolve a composition into a JSON manifest (`--json`) |
| `tagen add` | Scaffold a new catalog card interactively |

All commands are read-only except `add`.

---

## Skill-Graph Discovery

`findVaultDir()` walks up from `process.cwd()` up to 10 parent directories, looking for
`skill-graph/vocabulary.yaml`. No config file needed — run `tagen` from anywhere inside a marketplace repo.

---

## Development

```bash
# Pin runtime via mise (.mise.toml in repo root)
mise install               # ensures bun matches the pinned version

# Run tests
bun test

# Typecheck
bun run typecheck          # tsgo --noEmit

# Build standalone binary (GitHub releases)
bun run build              # → bin/tagen

# Build npm bundle (~250KB JS)
bun run build:npm          # → bin/tagen.js

# Run directly during development
bun run src/main.ts <command>
```

---

## Source Structure

```
src/
├── main.ts                 # CLI entrypoint, arg parsing, command dispatch
├── commands/
│   ├── add.ts              # tagen add (interactive scaffold; only writer)
│   ├── demo.ts             # tagen demo
│   ├── get.ts              # tagen get
│   ├── list.ts             # tagen list
│   ├── tags.ts             # tagen tags
│   └── validate.ts         # tagen validate
├── lib/
│   ├── types.ts            # CatalogCard, Subagent, Manifest, Vocabulary, …
│   ├── catalog.ts          # findVaultDir(), loadAllCards(), filterCards()
│   ├── vocabulary.ts       # loadVocabulary(), validateCard()
│   ├── capabilities.ts     # loadCapabilities(), isValidCapability()
│   ├── protocols.ts        # loadProtocols(), isValidProtocol()
│   ├── subagents.ts        # loadSubagents()
│   └── compose.ts          # compose(), buildManifest()
└── validator-runtime.ts    # @questi0nm4rk/tagen/validator-runtime export
```

Each command exports a `run<Name>(...): Promise<void> | void`. `main.ts` dispatches by argv[2].

---

## Tests

```
__tests__/
├── fixtures/
│   └── skill-graph/             # canonical fixture (vocabulary, capabilities,
│                                # protocols, skills, subagents)
├── catalog.test.ts              # findVaultDir, loadAllCards
├── vocabulary.test.ts           # validateCard, dimension rules
├── capabilities.test.ts         # loadCapabilities
├── protocols.test.ts            # loadProtocols
├── subagents.test.ts            # loadSubagents
├── compose.test.ts              # compose(), buildManifest()
├── validate.test.ts             # full validate pipeline
└── manifest-contract.test.ts    # `tagen get --json` against tagen-get-manifest.schema.json
```

Tests use `__tests__/fixtures/skill-graph/` as the vault root — no real marketplace dependency.

---

## BDD Features

```
features/
├── tags.feature
├── validate.feature
├── list.feature
├── demo.feature
├── get.feature
└── add.feature
```

One `.feature` per command, full edge-matrix coverage. Uses `@questi0nm4rk/feats`. Run with `bun test`.

---

## Development Workflow

1. Write a failing feature scenario (or unit test if internal-only)
2. Implement the minimum to pass
3. Run `bun test` — must be green
4. Run `bun run typecheck` — must be clean
5. Commit (conventional commits)

Never claim done if `bun test` or `bun run typecheck` haven't been run green in the current session.

---

## Adding a Command

1. Create `src/commands/<name>.ts`
2. Export `export async function run<Name>(args): Promise<void>` (or sync `void`)
3. Register in `src/main.ts` dispatch
4. Add `__tests__/<name>.test.ts` for unit coverage
5. Add `features/<name>.feature` + `features/steps/<name>.steps.ts`

---

## Code Style — apply when writing AND reviewing

Every file in `src/`, `__tests__/`, and `features/` must follow:

- **Modular** — one file, one responsibility. Split by behaviour, not by size.
- **Reusable** — shared helpers go in `src/lib/` (or `features/steps/common.steps.ts` for BDD); never copy-paste.
- **KISS** — simplest construct that works. No premature abstraction, no factories wrapping a single call.
- **DRY** — same shape in two places → extract.

Reviews (including `/simplify`) enforce the same rules. Flag and fix:

- Functions > ~50 lines or doing more than one thing → split.
- Duplicated literals, regex, or string templates in 2+ files → shared helper.
- Classes / wrappers around a single function call → unwrap.
- Config-object parameters with > 4 fields when 2 positional args suffice.
- Runtime assertions that re-check what the type system already proves.
- Newly exported symbols with one caller → inline unless reuse is concrete.

---

## Key Design Decisions

### Language filter — inclusive
`tagen list/demo/get --language python` matches `python` OR `agnostic`.
Single-string field; two specific languages → split into two cards.

### Convention over configuration
`tagen` finds the skill-graph by walking up from CWD looking for `skill-graph/vocabulary.yaml`.
No `.tagenrc`, no `tagen.config.ts`.

### Vocabulary in marketplace, not in tagen
`vocabulary.yaml`, `capabilities.yaml`, `protocols/`, and `subagents/` all live under the
marketplace's `skill-graph/`. Adding a new tag value, capability, protocol, or subagent never
requires a tagen release.

### Read-only by contract
Every command except `add` is read-only. `tagen get` writes the manifest to stdout, warnings to stderr.

---

## ai-guardrails

Strict profile enforced. No direct commits to main. All changes via PR.

---

## Commits

Conventional commits:

```
feat: …
fix: …
refactor: …
test: …
docs: …
```

---

## Publishing

```bash
bun run build:npm           # produces bin/tagen.js
npm publish                 # publishes with bin/tagen.js as the tagen bin
```

Version in `package.json` is the source of truth for npm. Bump before publishing.

---

## AI Guardrails - Code Standards

This project uses [ai-guardrails](https://github.com/Questi0nM4rk/ai-guardrails) for pedantic code enforcement.
Pre-commit hooks auto-fix formatting, then run security scans, linting, and type checks.
