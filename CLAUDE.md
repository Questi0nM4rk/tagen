# CLAUDE.md — tagen

Standalone read-only CLI that walks a calling project's `brain/<type>/<name>/`
directory tree of typed cards and emits a harness-neutral JSON composition manifest.

The directory tree IS the vocabulary — no `vocabulary.yaml`, no `capabilities.yaml`,
no `tags:` / `provides:` / `emits:` / `consumes:` frontmatter. Five frontmatter
fields exist: `description`, `aliases`, `requires`, `uses`, `subagents`.

Spec: `docs/specs/SPEC-tagen.md`. Manifest contract: `docs/tagen-get-manifest.schema.json`.

---

## Commands

| Command | Description |
|---------|-------------|
| `tagen list` | List catalog cards as `<type>/<name>`. Flags: `--type T`, `--aliases`, `--json` |
| `tagen search` | Full-text fuzzy search across card content, card-ranked. Flags: `--type T`, `--json` |
| `tagen validate` | Walk the tree, report every rule violation, non-zero exit on any |
| `tagen get` | Resolve a composition into a JSON manifest (`--json`). Bare type-name args trigger browse intent |
| `tagen add` | Interactive scaffold for a new card (the only writer) |

All commands are read-only except `add`.

---

## Brain Discovery

`findBrainDir()` walks up from `process.cwd()` up to 10 parent directories,
looking for a `brain/` directory with at least one `<type>/<name>/CORE.md`. No
config file needed — run `tagen` from anywhere inside a marketplace repo.

---

## Development

```bash
mise install                   # ensures bun matches the pinned version
bun test                       # full suite (unit + BDD)
bun run typecheck              # tsgo --noEmit
bun run lint                   # biome check
bun run build                  # → bin/tagen (standalone binary)
bun run build:npm              # → bin/tagen.js (npm bundle)
bun run src/main.ts <command>  # run directly during development
```

---

## Source Structure

```
src/
├── cli/
│   ├── args.ts             # raw argv parsing
│   ├── command.ts          # command classes, policies, and command context
│   ├── errors.ts           # CLI failure reporting
│   ├── parameter.ts        # immutable typed CLI parameter classes
│   ├── result.ts           # immutable command exit result
│   └── root.ts             # shared --root parameter
├── commands/
│   ├── index.ts            # readonly command-object registry
│   ├── add.ts              # tagen add (interactive scaffold; only writer)
│   ├── get.ts              # tagen get
│   ├── list.ts             # tagen list
│   ├── search.ts           # tagen search
│   └── validate.ts         # tagen validate
├── composition/
│   ├── index.ts            # composition orchestration + public API
│   ├── contracts.ts        # immutable composition input/output contracts
│   ├── match-cards.ts      # explicit/fuzzy seed matching + browse intent
│   ├── resolve-slots.ts    # requires-slot candidates, pins, fillers
│   ├── build-manifest.ts   # immutable manifest assembly
│   └── card-order.ts       # deterministic card ordering
├── search/
│   ├── index.ts            # searchCards() orchestration + ranking + public API
│   ├── contracts.ts        # SearchQuery value object + result contracts
│   └── match.ts            # pure word/token matching (substring + Levenshtein ≤ 1)
├── lib/
│   ├── types.ts            # Card, CardFrontmatter, Manifest, …
│   ├── catalog.ts          # findBrainDir(), loadAllCards(), marketplaceRoot()
│   ├── errors.ts           # safe unknown-error message extraction
│   ├── frontmatter.ts      # parseCore() with strict per-type field allowlist
│   ├── fuzzy.ts            # exact > prefix > substring > Levenshtein matcher
│   ├── aliases.ts          # global alias collision detection
│   ├── card-references.ts  # canonical uses resolution + cycle detection
│   ├── harness-guard.ts    # harness-specific token scanner
│   └── immutable-collections.ts # runtime-immutable Map/Set contracts
├── validation/
│   ├── card-validator.ts   # card shape, references, aliases, uses
│   ├── harness-validator.ts # harness-neutral content policy
│   ├── protocol-validator.ts # schemas, validators, protocol examples
│   └── self-contained-validator.ts # no inline brain/<type>/<name> paths in card bodies
├── main.ts                 # globals, lookup, catalog policy, command execution
└── validator-runtime.ts    # @questi0nm4rk/tagen/validator-runtime export
```

Each command exports its direct `run<Name>(...)` API and one command class.
Every CLI parameter has its own parameter class. `main.ts` resolves immutable
command objects from `commands/index.ts`; it contains no
command-name switch.

---

## Tests

```
__tests__/
├── fixtures/brain/         # canonical synthetic fixture (8 types, 11 cards)
├── helpers/capture.ts      # stdout/stderr capture for command-level tests
├── catalog.test.ts         # findBrainDir, loadAllCards, marketplaceRoot
├── frontmatter.test.ts     # parseCore + per-type allowlist enforcement
├── fuzzy.test.ts           # tier ordering, 3-char min, ambiguity
├── compose.test.ts         # resolution algorithm end-to-end
├── list.test.ts            # text + JSON output, --type, --aliases
├── search.test.ts          # tokenizing, matching, ranking, text/JSON output, cap
├── validate.test.ts        # clean fixture passes; broken-fixture clones per rule class
├── get.test.ts             # manifest + browse intent + exit codes
├── add.test.ts             # scaffoldCard frontmatter shape + interactive scaffold
├── cli-args.test.ts        # parameter-object argv parser policies
├── command-registry.test.ts # command-object uniqueness + help metadata
├── immutability.test.ts    # runtime immutability of exported contracts
├── manifest-contract.test.ts # `tagen get --json` validated against the schema
├── perf.test.ts            # 100-card synthetic fixture < 500ms
└── cli.test.ts             # --help / --version / unknown command
```

Tests use `__tests__/fixtures/brain/` as the canonical fixture; broken-fixture
scenarios in `validate.test.ts` clone it into a temp dir and mutate before
running. No real marketplace dependency.

---

## BDD Features

```
features/
├── list.feature
├── search.feature
├── validate.feature
├── get.feature
├── add.feature             # CLI shape only — interactive flow covered by add.test.ts
└── steps/
    ├── shared.ts           # World type, runTagen(), cloneFixtureBrain()
    └── common.steps.ts     # all step definitions in one file (CucumberExpression syntax)
```

Run with `bun test`. Step patterns use `{int}`, `{string}`, `{word}`, `{}` —
not RegExp.

---

## Development Workflow

1. Write a failing test (unit or BDD)
2. Implement the minimum to pass
3. `bun test` — must be green
4. `bun run typecheck` — must be clean
5. `bun run lint` — must be clean
6. Commit (conventional commits)

Never claim done if `bun test`, `bun run typecheck`, or `bun run lint` haven't been run green in the current session.

---

## Adding a Command

1. Create `src/commands/<name>.ts`
2. Export `run<Name>(...)` and a `Command` subclass
3. Define each accepted flag/option/positional as its own parameter class
4. Add one immutable command instance to `src/commands/index.ts`
5. Add `__tests__/<name>.test.ts`
6. Add scenarios to `features/<name>.feature` (steps go in `common.steps.ts`)

---

## Code Style — apply when writing AND reviewing

Every file in `src/`, `__tests__/`, and `features/` must follow:

- **Modular monolith** — one binary, capability-owned modules, explicit public
  APIs, private internals, and deliberate inward dependency direction.
- **Modular** — one file, one responsibility. Split by behaviour, not by size.
- **Reusable** — shared helpers go in `src/lib/`; never copy-paste.
- **KISS** — simplest construct that works. No premature abstraction.
- **DRY** — same shape in two places → extract.
- **Object-owned behavior** — commands, parameters, policies, and behavioral
  states are classes/value objects. Prefer these over enum/string state.
- **Static and immutable** — strict types, readonly fields/collections,
  constructor validation, and no mutation after construction by default.

Reviews (including `/simplify`) enforce the same rules. Flag and fix:

- Functions > ~50 lines or doing more than one thing → split.
- Duplicated literals/regex/templates in 2+ files → shared helper.
- Enum/string states with behavior or transitions → replace with typed objects.
- Mutable public collections or option bags → make readonly or encapsulate.
- Config-object parameters with > 4 fields when 2 positional args suffice.
- Runtime assertions that re-check what the type system already proves.
- Newly exported symbols with one caller → inline unless reuse is concrete.

---

## Key Design Decisions

### The directory tree IS the vocabulary
Adding a new type = `mkdir brain/<newtype>/`. Adding a new card =
`mkdir brain/<type>/<name>/`. Renames are `mv`. No registry file to keep in sync.

### Convention over configuration
`tagen` finds the brain by walking up from CWD looking for
`brain/<type>/<name>/CORE.md`. No `.tagenrc`, no `tagen.config.ts`.

### Strict per-type frontmatter allowlist
Every type has an exact allowed-field set. `subagents:` is review/methodology
only. `uses:` is subagent only and names canonical `<type>/<name>` cards.
Anything outside the allowlist for a given type is a `tagen validate` error.

### Harness-neutral brain
`brain/` contains no vendor model names, harness lifecycle events, harness
paths, or harness-only commands. `tagen validate` enforces this through the
agnostic guard. Harness adapters own model choice and registration details.

### Read-only by contract
Every command except `add` is read-only. `tagen get` writes the manifest to stdout, warnings to stderr.

### `tools/` is not tagen's concern
Tagen never reads `tools/*/.claude-plugin/plugin.json`. That's Anthropic's
schema and Claude Code's responsibility.

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
# bump "version" in package.json, commit, then:
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

The tag starts `.github/workflows/release.yml`, which publishes to npm with trusted publishing (OIDC, no token) and creates the GitHub release. It fails when the tag and `package.json` version differ. Do not run `npm publish` by hand.

---

## AI Guardrails - Code Standards

This project uses [ai-guardrails](https://github.com/Questi0nM4rk/ai-guardrails) for pedantic code enforcement.
Pre-commit hooks auto-fix formatting, then run security scans, linting, and type checks.
