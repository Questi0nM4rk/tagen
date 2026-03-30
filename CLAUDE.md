# CLAUDE.md — tagen

Standalone CLI for qsm-marketplace skill-graph assembly. Reads catalog cards and vocabulary from a calling project's `skill-graph/` directory; assembles CC-consumable plugins.

Extracted from qsm-marketplace `src/`. Published to npm as `tagen`.

---

## Commands

| Command | Description |
|---------|-------------|
| `tagen list` | List all catalog cards; `--filter key=value` for tag filtering |
| `tagen tags` | Print controlled vocabulary (all dimensions and valid values) |
| `tagen resolve` | Resolve tag query to matching skills (agnostic included for language) |
| `tagen validate` | Validate all catalog card tags against `vocabulary.yaml`; exits non-zero on any error |
| `tagen sync` | Find `skill-graph/skills/*.md` files not registered in any build.yaml |
| `tagen add` | Scaffold a new catalog card interactively |
| `tagen build` | Assemble plugins from catalog cards via tag queries in `build.yaml` |
| `tagen diff` | Check if assembled plugin output matches current catalog content |

---

## Skill-Graph Discovery

`findVaultDir()` walks up from `process.cwd()` up to 10 parent directories, looking for `skill-graph/vocabulary.yaml`. No config file needed — run `tagen` from anywhere inside a marketplace repo.

---

## Development

```bash
# Run tests (45+ tests across __tests__/)
bun test

# Typecheck
bun run typecheck          # tsgo --noEmit

# Build binary (GitHub releases)
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
│   ├── add.ts              # tagen add
│   ├── build.ts            # tagen build [--plugin <name>] [--all] [--no-bump]
│   ├── diff.ts             # tagen diff [--plugin <name>] [--all]
│   ├── list.ts             # tagen list [--filter key=value]
│   ├── resolve.ts          # tagen resolve --phase X --language Y ...
│   ├── sync.ts             # tagen sync
│   ├── tags.ts             # tagen tags
│   └── validate.ts         # tagen validate
└── lib/
    ├── types.ts            # CatalogCard, BuildQuery, PluginManifest, VocabularyFile
    ├── catalog.ts          # findVaultDir(), loadCatalog(), loadVocabulary(), loadBuildYaml()
    ├── build-utils.ts      # strictFilterCards(), computeHash(), generateSkillMd(), writePlugin()
    └── vocabulary.ts       # validateCard(), dimension rules, known required fields
```

Each command exports a `run<Name>(args: string[]): Promise<void>` function. `main.ts` dispatches by argv[2].

---

## Tests

```
__tests__/
├── fixtures/
│   ├── skill-graph/
│   │   ├── vocabulary.yaml      # Minimal controlled vocabulary
│   │   └── skills/              # 3-5 minimal catalog cards covering edge cases
│   └── plugins/                 # Expected output for diff tests
├── catalog.test.ts              # findVaultDir, loadCatalog, loadVocabulary
├── build-utils.test.ts          # strictFilterCards, computeHash, generateSkillMd
└── vocabulary.test.ts           # validateCard, required dimensions, unknown values
```

Tests use `__tests__/fixtures/` as the vault root — no real marketplace dependency.

---

## BDD Features

```
features/
├── build.feature                # Plugin assembly end-to-end
├── validate.feature             # Tag validation rules
├── resolve.feature              # Tag query resolution, agnostic inclusion
└── diff.feature                 # Diff detects content changes
```

Uses `@questi0nm4rk/feats` BDD framework. Run with `bun test`.

---

## Development Workflow

1. Write a failing feature scenario or unit test
2. Implement the minimum to pass
3. Run `bun test` — must be green
4. Run `bun run typecheck` — must be clean
5. Commit (conventional commits, see below)

Never claim done if `bun test` or `bun run typecheck` have not been run green in the current session.

---

## Adding a Command

1. Create `src/commands/<name>.ts`
2. Export `export async function run<Name>(args: string[]): Promise<void>`
3. Import and register in `src/main.ts` dispatch table
4. Add test in `__tests__/<name>.test.ts`
5. Add feature scenario in `features/<name>.feature` if behavior is user-facing

---

## Key Design Decisions

### Language filter: EXACT in build, inclusive in resolve
- `tagen build` with `language: python` matches ONLY `language: python` cards.
- `tagen resolve --language python` matches `language: python` OR `language: agnostic`.
- Rationale: plugin assembly must be precise; discovery should surface agnostic skills.

### Full rebuild, content-hash skip
- Every `tagen build` run resolves all queries from scratch.
- Writes are skipped if the content hash matches `.build-hash`.
- No incremental mode — partial state is worse than a slow full pass.

### Vocabulary in marketplace, not in tagen
- `vocabulary.yaml` lives in `skill-graph/vocabulary.yaml` in the calling project.
- Tagen reads and validates against it; adding new tag values needs no tagen release.

### No config file
- Tagen finds the skill-graph by walking up from CWD.
- No `.tagenrc`, no `tagen.config.ts`. Convention only.

---

## ai-guardrails

Strict profile enforced. No direct commits to main. All changes via PR.

---

## Commits

Conventional commits:

```
feat: add tagen diff --watch mode
fix: resolve handles missing concerns field gracefully
refactor: extract computeHash to build-utils
test: add vocabulary validation edge cases
docs: update SPEC-002 with --no-bump flag
```

---

## Publishing

```bash
bun run build:npm           # produces bin/tagen.js
npm publish                 # publishes with bin/tagen.js as the tagen bin
```

Version in `package.json` is the source of truth for npm. Bump before publishing.
