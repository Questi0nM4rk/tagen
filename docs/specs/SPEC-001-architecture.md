# SPEC-001: Architecture & Repository Setup

**Status:** Active (migration in progress from qsm-marketplace)
**Repo:** Questi0nM4rk/tagen
**npm package:** `tagen` (unscoped — confirmed available)

---

## Overview

`tagen` is the standalone CLI for the qsm-marketplace skill-graph. It reads catalog cards (`skill-graph/skills/*.md`) and a controlled vocabulary (`skill-graph/vocabulary.yaml`) from the calling project, assembles CC-consumable plugins, and validates tag hygiene across the graph.

Previously embedded in qsm-marketplace under `src/`. Extracted to a standalone npm package so any skill-graph marketplace can use it as a devDependency.

---

## Iron Laws

1. **Convention over configuration** — WHY: no config file means one less thing to misplace; the skill-graph location is discovered by walking up from CWD.
2. **Deterministic builds** — WHY: same input always produces same output; content-hash skip prevents spurious writes without introducing incremental state.
3. **Full rebuild per invocation** — WHY: partial state is worse than slow; incremental mode introduces invalidation bugs that corrupt assembled plugins.
4. **Vocabulary lives in the marketplace, not in tagen** — WHY: vocabulary evolves with content, not with the tool; tagen validates against whatever `vocabulary.yaml` it finds, no tagen release needed for new values.
5. **Content-hash skip, not mtime** — WHY: mtime is not deterministic across environments (CI, clones, Docker); SHA-256 of sorted skill bodies is.

### DON'Ts

- **DON'T embed vocabulary.yaml in tagen** — WHY: forces a tagen release every time a new tag value is needed; vocabulary evolves at content speed, not tool speed.
- **DON'T implement incremental builds** — WHY: partial state invalidation is complex and error-prone; full rebuild with content-hash skip is fast enough for 100+ skills.
- **DON'T use a config file** — WHY: convention-based discovery (walk up for `skill-graph/vocabulary.yaml`) is simpler and works across all marketplaces without per-project setup.
- **DON'T add runtime dependencies beyond `yaml`** — WHY: the CLI is installed globally; every extra dep is a version-conflict risk; `yaml` is the only external format tagen has to parse.

---

## Repository Structure

```
tagen/
├── src/
│   ├── main.ts                   # CLI entrypoint, command dispatch
│   ├── commands/
│   │   ├── add.ts                # Scaffold new catalog card
│   │   ├── build.ts              # Assemble plugins from catalog cards
│   │   ├── diff.ts               # Compare assembled plugin against catalog
│   │   ├── list.ts               # List skills with optional tag filter
│   │   ├── resolve.ts            # Resolve tag queries to matching skills
│   │   ├── sync.ts               # Find unregistered skills
│   │   ├── tags.ts               # Show controlled vocabulary
│   │   └── validate.ts           # Validate catalog card tags
│   └── lib/
│       ├── types.ts              # CatalogCard, BuildQuery, PluginManifest, etc.
│       ├── catalog.ts            # findVaultDir(), loadCatalog(), loadVocabulary()
│       ├── build-utils.ts        # strictFilterCards(), computeHash(), generateSkillMd()
│       └── vocabulary.ts         # validateCard(), known dimensions
├── __tests__/
│   ├── fixtures/
│   │   ├── skill-graph/
│   │   │   ├── vocabulary.yaml   # Minimal controlled vocabulary for tests
│   │   │   └── skills/           # 3-5 minimal catalog cards
│   │   └── plugins/              # Expected plugin output for diff tests
│   ├── catalog.test.ts           # findVaultDir, loadCatalog, loadVocabulary
│   ├── build-utils.test.ts       # strictFilterCards, computeHash, generateSkillMd
│   └── vocabulary.test.ts        # validateCard, dimension rules
├── features/
│   ├── build.feature             # BDD: plugin assembly end-to-end
│   ├── validate.feature          # BDD: tag validation rules
│   ├── resolve.feature           # BDD: tag query resolution
│   └── diff.feature              # BDD: diff detects changes
├── docs/
│   └── specs/
│       ├── SPEC-INDEX.md
│       ├── SPEC-001-architecture.md    (this file)
│       ├── SPEC-002-build-system.md
│       └── SPEC-003-tag-vocabulary.md
├── bin/                          # gitignored: compiled output
│   ├── tagen                     # Compiled binary (GitHub releases)
│   └── tagen.js                  # Bundled JS (npm install)
├── package.json
├── tsconfig.json
├── CLAUDE.md
└── README.md
```

---

## Commands (8 total)

| Command | Description |
|---------|-------------|
| `list` | List all catalog cards, optionally filtered by tag |
| `tags` | Print the controlled vocabulary (all dimensions and values) |
| `resolve` | Resolve a tag query to matching skills (includes agnostic for language) |
| `validate` | Validate all catalog card tags against vocabulary.yaml |
| `sync` | Find skill files on disk not registered in any catalog card |
| `add` | Scaffold a new catalog card interactively |
| `build` | Assemble plugins from catalog cards using build.yaml queries |
| `diff` | Check if assembled plugin output matches current catalog content |

---

## Distribution

### npm package (primary)
- Bundle: `bun build src/main.ts --target=bun --outfile=bin/tagen.js`
- Approx. 250KB bundle, no native deps
- Install: `bun add -g tagen` or `npm install -g tagen`
- `package.json` bin: `{ "tagen": "bin/tagen.js" }`

### GitHub Releases (compiled binary)
- Compile: `bun build src/main.ts --compile --outfile=bin/tagen`
- One self-contained binary, no Bun runtime required
- Attached to GitHub releases for download

### As devDependency in a marketplace
```json
{
  "devDependencies": {
    "tagen": "latest"
  }
}
```
```bash
bun install
bunx tagen build --all
bunx tagen validate
```

---

## Skill-Graph Discovery

`findVaultDir()` walks up from `process.cwd()` looking for `skill-graph/vocabulary.yaml`. Checks up to 10 parent directories. Errors with a clear message if not found.

This means `tagen` works correctly from any subdirectory of a marketplace repo, and works without any configuration.

---

## Dependencies

| Package | Type | Purpose |
|---------|------|---------|
| `yaml` | prod | Parse skill frontmatter and vocabulary.yaml |
| `@questi0nm4rk/feats` | dev | BDD test framework |
| `bun` | dev | Runtime, bundler, test runner |

No other runtime dependencies. `node:crypto`, `node:fs`, `node:path` are used from the standard library.

---

## Migration Steps

| Step | Status |
|------|--------|
| Repo created: Questi0nM4rk/tagen | Done |
| Source copied from qsm-marketplace/src/ (excluding tools/, scripts/) | Done |
| Standalone package.json, tsconfig.json created | Done |
| SPEC files written | Done |
| Write tests + feature files | Next |
| ai-guardrails init | Next |
| Publish to npm | Next |
| Add as devDep in qsm-marketplace, remove src/ from marketplace | Next |
| Confirmation gate: `bunx tagen validate` passes on marketplace using npm-installed tagen | Next |

---

## Constraints

- No config file — discovery is purely convention-based
- No incremental mode — full rebuild always; content-hash skip is the performance lever
- No native bindings — pure TypeScript/JS, compiles anywhere Bun runs
- Vocabulary.yaml is owned by the marketplace, not by tagen
- `yaml` is the only production dependency
- Bun runtime required for npm install usage; standalone binary for release usage

---

## Evolution

| Version | Change |
|---------|--------|
| 0.1.0 | Initial extraction from qsm-marketplace |
| — | Add BDD features, tests, ai-guardrails |
| — | First npm publish |
| — | qsm-marketplace switches from src/ to npm dep |
