<!-- markdownlint-disable MD013 -->

# SPEC-tagen — qsm-marketplace skill-graph CLI

> One spec. One source of truth. No legacy. No versioning.

**Repo:** Questi0nM4rk/tagen
**npm:** `@questi0nm4rk/tagen`
**Consumers:** [qsm-marketplace2](https://github.com/Questi0nM4rk/qsm-marketplace2) and any future skill-graph that follows the same layout.

---

## What tagen is

A standalone read-only CLI that an agent (and a human) calls to **discover** and **compose** skill-graph content at runtime. It walks up from CWD to find a `skill-graph/` directory, validates its content against controlled vocabularies, and answers tag queries by emitting a JSON manifest naming every brain file, subagent prompt, slot-filler ref, and validator the agent should load for a given task.

Tagen is the query layer between the marketplace's skill-graph and the agent. It owns no methodology and writes no files.

---

## What tagen is NOT (deliberate non-features)

These were on the table previously and are out:

- **Not a plugin assembler.** No `tagen build`. No `tagen diff`. No `.build-hash`. No `marketplace.json` generation. Tools and `marketplace.json` in qsm-marketplace2 are hand-maintained — see qsm-marketplace2 CLAUDE.md.
- **Not a build.yaml processor.** No per-plugin source-of-truth YAML. Cards in `skill-graph/skills/` are the only catalog input.
- **Not a name resolver.** Tags are the primary interface. `tagen get strict-review` is not the canonical path; `tagen get --domain code-review --language dotnet` is. (`--card NAME` exists as an override; see CLI flags.)
- **Not an auto-resolver.** Tagen does not pull transitive `requires` from cards outside the matched set. It warns; the agent decides.
- **Not a writer.** All commands are read-only except `tagen add` (interactive scaffold).
- **Not versioned content.** Capability names, protocol names, and subagent names are rewritten in place, never suffixed.

---

## Iron Laws

Each law has a **WHY** that names the failure mode it prevents.

1. **Convention over configuration.**
   WHY: No `.tagenrc`. The skill-graph is found by walking up from CWD looking for `skill-graph/vocabulary.yaml`. One less thing to misplace; works from any subdir of any marketplace.

2. **Vocabulary lives in the marketplace, not in tagen.**
   WHY: Vocabulary evolves at content speed; tagen evolves at tool speed. Adding a new tag value, capability, protocol, or subagent never requires a tagen release.

3. **Tags are the primary interface.**
   WHY: Tags are discoverable via `tagen list --filter`. Names require a lookup table the agent has to maintain. Module names are an implementation detail.

4. **Tagen validates, agent resolves.**
   WHY: Tagen sees only tags; the agent sees full task context. Auto-resolving transitive `requires` pulls modules the user didn't ask for. Tagen reports unmet capabilities; the agent decides.

5. **Manifest, not files.**
   WHY: `tagen get` writes JSON to stdout. No disk state, no cleanup, no version conflicts. Query is safe to run repeatedly.

6. **Progressive disclosure via tiers.**
   WHY: Cards split into `surface` (~50 tok), `core` (~500–2000 tok), `deep` (~2000–10000 tok). The agent pays for context it actually uses.

7. **Composition is declarative.**
   WHY: Cards declare `provides` / `requires` / `emits` / `consumes`. Tagen matches on those. No imperative glue, no sibling-name references, no platform branching inside methodologies.

8. **Unfilled slots and unmet requires are warnings, not errors.**
   WHY: The agent may legitimately compose without a slot (running a language-agnostic review without language patterns). Errors would block intentional partial compositions.

9. **No versioning on any vocabulary or contract name.**
   WHY: Single-maintainer closed catalog. Breaking changes rename the value and update every reference in one PR. Versioning pays for external consumers we don't have. (Trigger to revisit: third parties shipping brain modules.)

10. **Validators are layered: protocol-level auto + card-level opt-in.**
    WHY: Protocol validators catch shape errors (schema). Card validators catch methodology semantics (`no-severity-labels`, `imperative-mood`). Both run before the agent stamps an artifact.

11. **One value per concept across vocabularies.**
    WHY: Synonyms split the graph. `web-scraping` and `scraping` would never co-resolve. Pick one, document it, fail loud on unknowns.

12. **Tagen is offline.** No network, no auth, no telemetry. Operates on local files.

---

## Repo layout

```
tagen/
├── src/
│   ├── main.ts                    # CLI entrypoint, command dispatch
│   ├── commands/
│   │   ├── tags.ts                # tagen tags
│   │   ├── validate.ts            # tagen validate
│   │   ├── list.ts                # tagen list
│   │   ├── demo.ts                # tagen demo
│   │   ├── get.ts                 # tagen get
│   │   └── add.ts                 # tagen add (interactive scaffold)
│   ├── lib/
│   │   ├── types.ts               # CatalogCard, Subagent, Manifest, etc.
│   │   ├── catalog.ts             # findVaultDir, loadCatalog
│   │   ├── vocabulary.ts          # loadVocabulary, validateCard (tags)
│   │   ├── capabilities.ts        # loadCapabilities, isValidCapability
│   │   ├── protocols.ts           # loadProtocols, isValidProtocol
│   │   ├── subagents.ts           # loadSubagents, findSubagent
│   │   ├── composer.ts            # composeManifest: tags → caps → slots → tiers
│   │   └── output.ts              # formatTable, formatJson
│   └── validator-runtime.ts       # secondary export (see Distribution)
├── __tests__/
│   ├── fixtures/skill-graph/      # vocabulary, capabilities, protocols, skills, subagents
│   └── *.test.ts                  # unit tests per lib/command
├── features/                      # BDD scenarios, one .feature per command
├── docs/
│   ├── specs/SPEC-tagen.md        # this file
│   └── tagen-get-manifest.schema.json   # JSON Schema for the get manifest
├── bin/                           # gitignored; compiled outputs
├── package.json
├── tsconfig.json
├── biome.jsonc
└── CLAUDE.md
```

---

## Distribution

Two install paths, same source.

| Path | Build | Runtime requirement |
|------|-------|---------------------|
| npm devDep / global | `bun build src/main.ts --target=bun --outfile=bin/tagen.js` | Bun on the consumer machine |
| Standalone binary | `bun build src/main.ts --compile --outfile=bin/tagen` | None — self-contained binary |

`package.json` exports both the CLI and a stable subpath for the validator runtime:

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

Tiny zero-dep helper for protocol and card validators. Keeps every validator script ≈ 30 lines instead of re-implementing stdin parsing.

```ts
import { readPayload, pass, fail } from "@questi0nm4rk/tagen/validator-runtime";

const artifact = await readPayload<{ body: string; inline: Array<{ body: string }> }>();
const severity = /\b(minor|major|critical|nitpick|suggestion)\b/i;
const hits: string[] = [];
if (severity.test(artifact.body)) hits.push("body contains severity label");
for (const [i, c] of artifact.inline.entries()) {
  if (severity.test(c.body)) hits.push(`inline[${i}]: severity label`);
}
hits.length ? fail(hits) : pass();
```

API:

```ts
export function readPayload<T = unknown>(): Promise<T>;
export function pass(): never;                          // exit 0
export function fail(violations: string[] | string): never;  // exit 1, one line per violation on stderr
```

I/O contract: stdin = JSON payload, exit 0 = pass, exit 1 + stderr lines = violations. Used by `skill-graph/protocols/<name>/validator.ts` (auto-applied per `emits`) and by `brain/<module>/validators/*.ts` (opt-in via `deep.validators`).

### Dependencies

| Package | Type | Purpose |
|---------|------|---------|
| `yaml` | prod | Parse YAML frontmatter + vocabulary files |
| `@questi0nm4rk/feats` | dev | BDD framework |
| `bun` | dev | Runtime + bundler + test runner |

`yaml` is the only runtime dep. `ajv` is NOT a tagen dep — it's needed by each marketplace's protocol validators and is added to the marketplace's own devDeps. Stdlib: `node:crypto`, `node:fs`, `node:path`, `node:process`.

---

## Skill-graph layout (consumed by tagen)

The marketplace owns this tree. Tagen reads it.

```
skill-graph/
├── vocabulary.yaml                # tag enums (phase, domain, language, layer, concerns)
├── capabilities.yaml              # capability enum (provides / requires / slot names)
├── protocols/
│   └── <name>/
│       ├── schema.json            # JSON Schema (draft-07+)
│       ├── protocol.md            # semantic doc + emit/consume guidance
│       ├── validator.ts           # auto-applied schema validator
│       └── examples/
│           ├── valid/*.json       # MUST validate
│           └── invalid/*.json     # MUST fail validation
├── skills/
│   └── <name>.md                  # catalog cards (one per brain module)
└── subagents/
    └── <name>.md                  # reusable worker prompts
```

Adjacent to `skill-graph/`, the marketplace also has `brain/<module>/` (methodology + slot-filler content referenced by cards) and `tools/<name>/` (CC plugins). Those live outside `skill-graph/` and are not tagen's concern beyond resolving paths in `core.files` / `deep.refs` / `deep.validators` (see Card schema).

### Discovery

`findVaultDir()` walks up to 10 parent directories from `process.cwd()` looking for `skill-graph/vocabulary.yaml`. The first match wins. If none is found, every command exits with a clear error.

---

## Vocabulary 1: Tags

Tags drive discovery and filtering. `vocabulary.yaml` enumerates each dimension's allowed values.

### `phase` — required, array or string

| Value | Meaning |
|-------|---------|
| `planning` | Backlog, estimation, scope definition |
| `design` | Architecture, system design, ADRs |
| `specification` | Specs, acceptance criteria, contracts |
| `implementation` | Writing production code |
| `testing` | Writing / running tests |
| `verification` | Type-check, lint, integration validation |
| `review` | Code review, PR review |
| `documentation` | Docs, changelogs, READMEs |
| `operations` | Deployment, monitoring, incidents |

Cards may have multiple phases.

### `domain` — required, array or string

| Value | Meaning |
|-------|---------|
| `architecture` | System structure, component design |
| `domain-modeling` | DDD aggregates, value objects, bounded contexts |
| `testing` | Test strategy, patterns, doubles |
| `data-access` | ORM, migrations, repository pattern |
| `api` | REST/gRPC/GraphQL API design + implementation |
| `validation` | Input validation, schema enforcement |
| `diagnostics` | Debugging, profiling, tracing |
| `workflow` | Development process, CI/CD, automation |
| `knowledge-management` | Vaults, notes, RAG |
| `agent-design` | Agent architectures, prompt engineering |
| `code-review` | Review automation, PR standards |
| `quality` | Code quality, static analysis, linting |
| `tooling` | Developer tooling, CLI tools |
| `web-scraping` | HTTP scraping, browser automation |
| `data-processing` | Transformation, pipeline, format conversion |
| `database` | SQL/NoSQL, query tools, schema management |

Cards may have multiple domains.

### `language` — required, **single string**

| Value | Meaning |
|-------|---------|
| `agnostic` | Applies to any language; methodology or tooling |
| `dotnet` | C# / .NET specific |
| `typescript` | TypeScript / JavaScript specific |
| `python` | Python specific |

Single string only (not array). Two specific languages → split into two cards. Both → `agnostic`.

Resolution:
- `tagen get --language python` matches `python` OR `agnostic` (inclusive).
- `tagen list --language python` same.
- The previous "exact" semantics existed only in the deleted `build` command and do not apply.

### `layer` — required, **single string**

| Value | Meaning |
|-------|---------|
| `orchestrator` | Composes / delegates to other skills |
| `methodology` | Process methodology (TDD, BDD, DDD); language-agnostic |
| `reference` | Reference material, lookup tables |
| `standards` | Coding standards, review rules, iron laws |
| `patterns` | Reusable implementation patterns |
| `analysis` | Diagnosis, investigation |
| `integration` | External system integration |
| `utility` | Low-level helpers, format conversion |

### `concerns` — optional, array

Cross-cutting. Used for fine-grained filtering; never required.

| Value | Meaning |
|-------|---------|
| `feature-decomposition` | Breaking features into tasks |
| `integration-analysis` | Cross-component dependency analysis |
| `quality` | Quality gates, metrics |
| `testing` | Testing concerns (overlaps `domain:testing`) |
| `performance` | Performance analysis, optimization |
| `security` | Security review, threat modeling |
| `error-handling` | Error propagation, recovery |
| `documentation` | Doc generation / standards |
| `code-generation` | Scaffolding, templates |
| `review-automation` | Automated review checks |
| `knowledge-capture` | Decisions, learnings, patterns |
| `agent-orchestration` | Multi-agent coordination |
| `context-management` | Context window management, compaction |
| `task-management` | Task tracking, issue management |
| `standards-enforcement` | Enforcing coding / process standards |
| `plan-lifecycle` | Plan creation, execution, completion |
| `cli-tooling` | CLI tool usage patterns |
| `json-output` | Producing / consuming structured JSON |

---

## Vocabulary 2: Capabilities

`capabilities.yaml` lists allowed capability names. Capabilities are service contracts referenced by `provides` / `requires` / slot names.

```yaml
capabilities:
  - review-methodology
  - spec-methodology
  - refactor-methodology
  - design-methodology
  - language-patterns
  - test-patterns
  - security-patterns
  - domain-vocabulary
```

Capabilities do NOT carry validator scripts. Validators are per-protocol and per-card (see Validator layering).

---

## Vocabulary 3: Protocols

Protocols are named JSON shapes used in `emits` / `consumes`. Each lives in its own directory.

| File | Required? | Purpose |
|------|-----------|---------|
| `schema.json` | yes | JSON Schema (draft-07+) |
| `protocol.md` | yes | Semantic doc + when emitted/consumed + sample payload |
| `validator.ts` | yes | Auto-applied schema validator (`@questi0nm4rk/tagen/validator-runtime` + ajv) |
| `examples/valid/*.json` | yes (≥1) | Payloads that MUST validate |
| `examples/invalid/*.json` | yes (≥1) | Payloads that MUST fail validation |

**Schema validation in CI:** ajv runs `schema.json` against every fixture in `examples/`. Valid examples must pass; invalid must fail.

Starting protocol set (additive — grows with the catalog):

| Protocol | Role | Typical emitter | Typical consumer |
|----------|------|------------------|-------------------|
| `recon-summary` | Haiku recon output (observations, not findings) | recon subagents | domain reviewers |
| `finding` | One review finding `{ file, line, description, in_diff }` | domain reviewers | synthesizer |
| `graded-findings` | `confirmed \| false-positive \| reframe-higher` validation output | review-validator (opus) | tool wrapper |
| `review-artifact` | Final review `{ event, body, inline[] }` | synthesizer | tool's `post-review` verb |
| `thread-list` | Unresolved review threads | tool's `threads` verb | review agents |
| `spec-doc` | Structured spec document | spec synthesizer | writer agents |
| `diff-patch` | Unified diff + metadata | refactor synthesizer | tool's patch-apply verb |

Tool plugin manifests reference protocols via a `verbs` array:

```json
{
  "verbs": [
    { "name": "post-review", "accepts": "review-artifact" },
    { "name": "threads",     "emits":   "thread-list" }
  ]
}
```

---

## Vocabulary 4: Subagents

Subagents are reusable worker prompts at `skill-graph/subagents/<name>.md`. Multiple cards reference the same subagent by name.

```yaml
---
name: security-reviewer       # MUST match filename stem
model: sonnet                 # haiku | sonnet | opus
description: "Performs domain-scoped security review of a diff partition."
consumes: [recon-summary]     # protocols ingested ([] = raw orchestrator context)
emits: [finding]              # protocols produced ([] allowed but unusual)
references: [language-patterns]   # capabilities needed at dispatch (slot-filled)
---

# Security Reviewer

## Role
<one paragraph — what this subagent does, methodology-agnostic>

## Input
<what the orchestrator passes>

## Output
<protocol reference + shape guidance>

## Process
<numbered operational steps>

## Constraints
<what NOT to do — methodology-agnostic>
```

Frontmatter rules:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | Must match filename stem |
| `model` | enum | yes | `haiku` \| `sonnet` \| `opus` |
| `description` | string | yes | One-line summary for `tagen list --subagents` |
| `consumes` | `protocol[]` | no (default `[]`) | Empty = raw orchestrator context |
| `emits` | `protocol[]` | no (default `[]`) | Empty = no structured output |
| `references` | `capability[]` | no | Slot-filled at dispatch from current composition |

Subagent body sections (`## Role` / `## Input` / `## Output` / `## Process` / `## Constraints`) are conventional; `tagen validate` does not enforce them. **Bodies must NOT hardcode CLI binary names** — the orchestrator knows which tool is installed.

Subagents must be reusable across methodologies. Methodology-specific behavior is passed via the manifest at dispatch time, not baked into the subagent body.

---

## Catalog card schema (canonical)

One file per card at `skill-graph/skills/<name>.md`. Filename stem = card identity. No legacy fields tolerated.

```yaml
---
skill: strict-review                # MUST match filename stem
description: "Zero-tolerance PR/MR review — every finding is a required change."

summary:                            # short one-line-per-law list for discovery only;
  - "One tier only — every finding blocks"   # the authoritative version with WHY lives in
  - "Zero findings = approve, any = request changes"   # core.files
  - "No post without user confirmation"

tags:
  phase: [review]
  domain: [code-review]
  language: agnostic                # single string
  layer: methodology                # single string
  concerns: [review-automation, quality]

# Service contracts (validated against capabilities.yaml)
provides: [review-methodology]
requires: [language-patterns]

# Data contracts (validated against skill-graph/protocols/<name>/)
emits: [graded-findings, review-artifact]
consumes: [finding, recon-summary]

# Tier 1: discovery
surface:
  triggers:
    - "review PR"
    - "strict review"
    - "zero-tolerance review"

# Tier 2: always loaded on activation
core:
  files:
    - refs/workflow.md              # paths relative to brain/<skill>/
    - refs/iron-laws.md
    - refs/output-format.md

# Tier 3: loaded for sub-agent dispatch
deep:
  subagents:                        # names; resolved from skill-graph/subagents/<name>.md
    - ai-slop-researcher
    - security-reviewer
    - architecture-reviewer
    - testing-reviewer
    - performance-reviewer
    - review-validator
  refs: []                          # card-owned refs (slot refs come via deep.slots)
  slots:                            # capability slots filled at compose time
    language-patterns: true
  validators:                       # card-level methodology checks
    - validators/no-severity-labels.ts
    - validators/imperative-mood.ts
    - validators/no-emoji.ts
---

<body — full module docs, referenced from core.files paths if pulled>
```

Field reference:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `skill` | string | yes | Identifier; matches filename stem |
| `description` | string | yes | One-line summary |
| `summary` | `string[]` | no | Discovery-only one-liners; authoritative WHY lives in `core.files` |
| `tags.phase` | `string[]` | yes | One or more values from `vocabulary.yaml` `phase` |
| `tags.domain` | `string[]` | yes | One or more values from `domain` |
| `tags.language` | string | yes | Single value from `language` |
| `tags.layer` | string | yes | Single value from `layer` |
| `tags.concerns` | `string[]` | no | Zero or more values from `concerns` |
| `provides` | `capability[]` | no | What this card offers |
| `requires` | `capability[]` | no | What this card needs (unmet → warning, not error) |
| `emits` | `protocol[]` | no | Data shapes this card produces |
| `consumes` | `protocol[]` | no | Data shapes this card ingests |
| `surface.triggers` | `string[]` | no | Phrases that suggest this card |
| `core.files` | `path[]` | no | Paths relative to `brain/<skill>/`. Routing depends on the card's role in the composition (see Composition resolution algorithm step 9): non-filler card → `manifest.core[]`; chosen filler card → `manifest.refs[]` tagged with the slot capability. |
| `deep.subagents` | `string[]` | no | Subagent names; tagen resolves each from `skill-graph/subagents/` |
| `deep.refs` | `path[]` | no | Additional card-owned refs (paths relative to `brain/<skill>/`). Routing follows the same role-based rules as `core.files`: non-filler card → added to `manifest.refs[]` with `slot: null`; chosen filler card → added to `manifest.refs[]` tagged with the slot capability. |
| `deep.slots` | `Record<capability, true>` | no | Slots filled by any matched card providing that capability |
| `deep.validators` | `path[]` | no | Card-level validator scripts |

**Rejected on validate:** any of `source`, `composes`, `enhances`, `iron_laws`, or `deep.agents` (inline prompt blocks). Renamed in earlier iterations: `iron_laws` → `summary`, inline `deep.agents` → `deep.subagents` (named references). Module root resolves by convention from filename — no `source:` field.

---

## Validator layering

Two layers run in order for every artifact emitted by a composition:

1. **Protocol validator** (auto, always) — `skill-graph/protocols/<name>/validator.ts` for each protocol in `emits`.
   Schema conformance via ajv. No opt-in; every emitter gets it.
2. **Card validators** (opt-in) — `deep.validators[]` paths relative to `brain/<skill>/`. Methodology-specific
   semantic constraints (`no-severity-labels`, `imperative-mood`, `no-emoji`). Run in declared order; all must pass.

Both layers share the I/O contract: stdin = JSON payload, exit 0 = pass, exit 1 + stderr = violations.
Helpers come from `@questi0nm4rk/tagen/validator-runtime`.

When all validators pass, the agent stamps `validated_by: <hash>` on the artifact and hands it to the tool's
receiving verb. **Tools refuse unsigned payloads.**

---

## Composition resolution algorithm

Used by `tagen demo` and `tagen get`. Read-only.

```
1. Load catalog from skill-graph/skills/*.md
2. Load vocabulary, capabilities, protocols from skill-graph/
3. Load subagents from skill-graph/subagents/*.md
4. Determine matched set:
     if --card NAME (repeatable) is present:
       matched = cards whose skill is in that list
     else:
       filter all cards by tag query (language is INCLUSIVE: lang OR agnostic)
   Sort matched alphabetically by `skill` (deterministic tie-break for slot resolution).
5. Collect provides / requires from matched set.
6. For each unmet `requires` (no matched card provides it):
     append to warnings  (do NOT auto-resolve from outside the matched set)
7. For each capability X needed by the matched set
   (union of all `requires:` plus all `references:` on subagents in `deep.subagents`):
     providers = matched cards whose `provides:` includes X
     if providers is empty: warning "unfilled slot for X"
     else:
       chosen = providers[0]                       # alphabetical first
       slot = {
         capability:  X,
         fillerCard:  chosen.skill,
         candidates:  all providers' skill names
       }
       append to slots[]
       if providers.length > 1:
         warning "multiple providers for X: [list]. Picked <chosen>. Use --card NAME to override."
8. Resolve subagents:
     for each card's deep.subagents[]:
       look up skill-graph/subagents/<name>.md
       if missing: warning "unknown subagent: <name> referenced by <card>"
     deduplicate (same subagent referenced by multiple cards = one entry)
     subagent.references[] are handled in step 7
9. Route content by role — every matched card's content lands in exactly one place:
     For each matched card C:
       fillerSlots = capabilities X for which C is the chosen filler (i.e., X
                     appears in slots[] with fillerCard = C.skill)
       If fillerSlots is empty (C is not filling any slot):
         For each f in C.core.files:           append f to manifest.core[]
         For each f in C.deep.refs:            append { path: f, slot: null } to manifest.refs[]
       Else (C is the chosen filler for one or more slots):
         For each f in C.core.files ∪ C.deep.refs:
           For each cap in fillerSlots:
             append { path: f, slot: cap } to manifest.refs[]
         (C.core.files do NOT appear in manifest.core[] in this case.)
10. Assemble manifest (see JSON contract below)
11. Output JSON to stdout; exit 0 on success, 1 on validation error, 2 on no match
```

### Why content routing splits this way

The manifest must make it **immediately obvious** to a reader (human or agent) which
files were loaded as the methodology's own context vs which were pulled in to fill a
named capability slot. That distinction drives prompt budgeting, slot debugging, and
the `--card` override workflow.

Routing truth table — what determines where each card's content lands:

| Card matched? | Card fills a slot? | `core.files` routed to | `deep.refs` routed to |
|---------------|--------------------|------------------------|----------------------|
| no            | n/a                | (not loaded)           | (not loaded) |
| yes           | no                 | `manifest.core[]`      | `manifest.refs[]` with `slot: null` |
| yes           | yes (one slot)     | `manifest.refs[]` with `slot: <cap>` | `manifest.refs[]` with `slot: <cap>` |
| yes           | yes (multiple)     | `manifest.refs[]` once per slot, each tagged with that `<cap>` | `manifest.refs[]` once per slot, each tagged with that `<cap>` |

Rule of thumb (reading the manifest):

| Where a path appears | What it means |
|----------------------|---------------|
| `manifest.core[]` | Loaded because a methodology (or other non-filler matched card) is in scope. No slot relationship. |
| `manifest.refs[]` with `slot: <cap>` | Loaded because the card filled the `<cap>` slot for someone else in the matched set. |
| `manifest.refs[]` with `slot: null` | Card-owned `deep.refs` from a non-filler card (loaded for sub-agent dispatch context). |

A card that is BOTH matched independently AND chosen as a filler is treated as a filler — its
content goes to `refs[]` tagged with the slot, never to `core[]`. The card still appears in
`modules[]` and the slots[] entry names it as `fillerCard`; its dual nature is recoverable
without duplicating its files across both buckets.

If a card fills multiple slots simultaneously (rare; would mean it `provides` multiple
capabilities that are all required in the same composition), each of its files appears
once per slot in `refs[]` — duplicate paths with different `slot:` tags. Agents can
deduplicate by path if they only care about which file to read; the per-slot grouping
is preserved for those who need it.

`--card NAME` (repeatable) is the agent's escape hatch when the alphabetical default would pick the wrong
card. It restricts the matched set to exactly the listed cards, bypassing tag-query filtering.

---

## Commands

Six commands. All read-only except `add`.

The CLI also recognises `--version` (alias `-V`) before any subcommand. It prints the bundled
`package.json` version to stdout and exits 0 without touching the skill-graph. This is the
first-line answer to "what version" in any bug report or CI log.

### `tagen tags`

Print all four vocabularies (tag enums + capabilities + protocols + subagent registry).

```
tagen tags [--json]
```

Exit codes: 0 (success), 1 (vocabulary load error).

### `tagen validate`

Validate every catalog card, subagent, protocol, and capability reference. Errors print to stderr;
non-zero exit on any failure.

```
tagen validate [--verbose]
```

Rules — full table in **Validation Rules** below. Always runs all checks (no fail-fast); prints all errors before exit.

Exit codes: 0 (clean), 1 (errors), 2 (vocabulary missing).

### `tagen list`

Browse the catalog or subagent registry. Inclusive filtering across dimensions.

```
tagen list [--phase X] [--domain X] [--language X] [--layer X] [--concerns X]
           [--capability X] [--protocol X] [--subagents] [--json]
```

Output (default human-readable):

```
$ tagen list --language dotnet --domain code-review

  csharp-patterns   dotnet / standards     provides: [language-patterns]
    .NET / C# / EF Core review patterns
    core: 1 file  deep: 2 refs

  strict-review     agnostic / methodology provides: [review-methodology]  requires: [language-patterns]
    Zero-tolerance PR/MR review — every finding is a required change.
    core: 4 files  deep: 9 subagents, 0 refs, 3 validators, slots: [language-patterns]
```

`--subagents` switches to listing subagent files instead of cards.

Exit codes: 0 (matches), 1 (validation error), 2 (no matches).

### `tagen demo`

Preview what `tagen get` would produce. Same flags as `list`, plus `--card` and `--verbose`.
Prints a human-readable composition summary with warnings.

```
tagen demo [filter flags] [--card NAME]... [--verbose] [--json]
```

Example (resolved):

```
$ tagen demo --domain code-review --language dotnet

  Modules: strict-review, csharp-patterns

  Capabilities:
    provided: review-methodology, language-patterns
    required: language-patterns OK (filled by csharp-patterns)

  Slots:
    language-patterns: filled by csharp-patterns (2 refs)

  Protocols:
    emits:    graded-findings, review-artifact
    consumes: finding, recon-summary

  Subagents: 7 total (1 haiku, 5 sonnet, 1 opus)

  Context: core 5 files (~2500 tok), deep 7 subagents + 2 refs + 3 validators (~11000 tok)

  Warnings: none
```

Example (unmet require):

```
$ tagen demo --domain code-review

  Modules: strict-review

  Warnings:
    ⚠ unmet requirement: language-patterns — no matched card provides it
    hint: add --language <lang> to include a language-patterns provider
```

Exit codes: 0 (manifest viable, warnings allowed), 1 (validation error), 2 (no matches).

### `tagen get`

Output the full JSON manifest the agent loads. Read-only. Same flags as `demo`.

```
tagen get [filter flags] [--card NAME]... [--dry-run]
```

`--dry-run` skips downstream protocol-schema check (still composes the manifest); useful for debugging.

JSON output goes to stdout; warnings go to stderr.

Exit codes: 0 (manifest emitted, warnings allowed), 1 (validation error), 2 (no matches).

### `tagen add`

Interactive scaffold for a new catalog card. Walks through the schema, validates against vocabularies,
writes `skill-graph/skills/<name>.md`. The only command that writes to disk.

```
tagen add
```

Exit codes: 0 (written), 1 (validation error or aborted).

---

## Manifest JSON contract

The output of `tagen get`. **This is a stable contract** — agents and tooling depend on the shape.
Breaking changes require a dedicated PR with consumers updated in lockstep.

```json
{
  "modules": ["csharp-patterns", "strict-review"],
  "core": [
    "brain/strict-review/refs/workflow.md",
    "brain/strict-review/refs/iron-laws.md",
    "brain/strict-review/refs/output-format.md"
  ],
  "subagents": [
    {
      "name": "ai-slop-researcher",
      "model": "haiku",
      "prompt": "skill-graph/subagents/ai-slop-researcher.md",
      "consumes": [],
      "emits": ["recon-summary"],
      "references": []
    },
    {
      "name": "security-reviewer",
      "model": "sonnet",
      "prompt": "skill-graph/subagents/security-reviewer.md",
      "consumes": ["recon-summary"],
      "emits": ["finding"],
      "references": ["language-patterns"]
    },
    {
      "name": "review-validator",
      "model": "opus",
      "prompt": "skill-graph/subagents/review-validator.md",
      "consumes": ["finding"],
      "emits": ["graded-findings"],
      "references": []
    }
  ],
  "refs": [
    { "path": "brain/csharp-patterns/refs/csharp-patterns.md", "slot": "language-patterns" }
  ],
  "slots": [
    {
      "capability": "language-patterns",
      "fillerCard": "csharp-patterns",
      "candidates": ["csharp-patterns"]
    }
  ],
  "validators": {
    "protocol": [
      { "protocol": "recon-summary",   "path": "skill-graph/protocols/recon-summary/validator.ts" },
      { "protocol": "finding",         "path": "skill-graph/protocols/finding/validator.ts" },
      { "protocol": "graded-findings", "path": "skill-graph/protocols/graded-findings/validator.ts" },
      { "protocol": "review-artifact", "path": "skill-graph/protocols/review-artifact/validator.ts" }
    ],
    "card": [
      { "module": "strict-review", "path": "brain/strict-review/validators/no-severity-labels.ts" },
      { "module": "strict-review", "path": "brain/strict-review/validators/imperative-mood.ts" },
      { "module": "strict-review", "path": "brain/strict-review/validators/no-emoji.ts" }
    ]
  },
  "emits":    ["graded-findings", "review-artifact"],
  "consumes": ["finding", "recon-summary"],
  "warnings": []
}
```

JSON Schema lives at `docs/tagen-get-manifest.schema.json` and is enforced by a dedicated CI test on every PR.
The schema is the **authoritative shape** of the manifest; the TypeScript interfaces below are a non-binding view of it.
When schema and types drift, the schema wins and the types must be brought into line.

Agent reads:
- `core[]` files into context immediately — the methodology's own context, no slot relationship.
- `refs[]` files into context immediately, grouped by `slot:` — the content that filled each
  named capability slot for the matched composition. `slot: null` entries are card-owned `deep.refs`.
- `subagents[]` for dispatch (name → prompt path, model from `model`).
- Pipe each subagent's output through `validators.protocol[]` for the matching `emits[0]`, then any
  `validators.card[]` from the same module. All exit 0 → pass.
- Stamp the artifact with `validated_by: <hash>`.
- Match `emits[]` against installed tool plugins' `verbs.*.accepts`; invoke the tool with the signed
  artifact.
- Read `warnings[]` first; decide whether to proceed partial or abort.

---

## TypeScript types (implementation contract)

These types live in `src/lib/types.ts` and form the contract between loaders, composer, and command layers.

```ts
export interface TagSet {
  phase: string[];
  domain: string[];
  language: string;     // single value
  layer: string;        // single value
  concerns: string[];
}

export interface SurfaceTier { triggers: string[]; }
export interface CoreTier { files: string[]; }   // paths relative to brain/<skill>/
export interface DeepTier {
  subagents: string[];                  // names → resolved from skill-graph/subagents/
  refs: string[];                       // paths relative to brain/<skill>/
  slots: Record<string, true>;          // capability → true
  validators: string[];                 // paths relative to brain/<skill>/
}

export interface CatalogCard {
  skill: string;                        // matches filename stem
  description: string;
  summary: string[];                    // discovery-only
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
}

export type SubagentModel = "haiku" | "sonnet" | "opus";

export interface Subagent {
  name: string;
  model: SubagentModel;
  description: string;
  consumes: string[];
  emits: string[];
  references: string[];
  body: string;
  filePath: string;
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

export interface CapabilityRegistry {
  capabilities: Record<string, string>;   // name → optional description
}

export interface ResolvedSubagent {
  name: string;
  model: SubagentModel;
  prompt: string;                          // repo-relative path
  description: string;                     // mirrors the subagent's frontmatter description
  consumes: string[];
  emits: string[];
  references: string[];
}

export interface ResolvedRef {
  path: string;
  slot: string | null;                     // capability that filled, or null if card-owned
}

export interface ResolvedSlot {
  capability: string;
  fillerCard: string;                      // chosen card's skill
  candidates: string[];                    // all providers in matched set
}

export interface ResolvedValidator {
  path: string;
  protocol?: string;                       // for protocol-level validators
  module?: string;                         // for card-level validators
}

export interface Manifest {
  modules: string[];
  core: string[];
  subagents: ResolvedSubagent[];
  refs: ResolvedRef[];
  slots: ResolvedSlot[];
  validators: { protocol: ResolvedValidator[]; card: ResolvedValidator[]; };
  emits: string[];
  consumes: string[];
  warnings: string[];
}
```

### Loader contracts

| Loader | Missing file | Malformed content |
|--------|--------------|-------------------|
| `loadVocabulary` | throw — required | throw |
| `loadCapabilities` | return empty registry | throw with clear error |
| `loadProtocols` | return `[]` | skip directory + warning |
| `loadSubagents` | return `[]` | skip file + warning |

`loadVocabulary` is the only fatal-on-missing case; without it the skill-graph isn't valid. The others
tolerate brand-new marketplaces that haven't populated every directory yet.

`loadSubagents` performs no semantic validation — that's `tagen validate`'s job. It returns whatever it
parsed; mismatched filename/`name`, garbage `model`, etc. are flagged later.

---

## Validation rules

`tagen validate` runs every check below. Errors all print before exit (no fail-fast).

### Tag rules

| Rule | Error |
|------|-------|
| `phase` missing | `<skill>: missing required dimension: phase` |
| `domain` missing | `<skill>: missing required dimension: domain` |
| `language` missing | `<skill>: missing required dimension: language` |
| `layer` missing | `<skill>: missing required dimension: layer` |
| Unknown value in any tag dimension | `<skill>: unknown <dim> value: "<value>"` |
| `language` or `layer` is array | `<skill>: <dim> must be a single string, not an array` |

### Capability rules

| Rule | Error |
|------|-------|
| Unknown `provides` | `<skill>: unknown capability in provides: "<value>"` |
| Unknown `requires` | `<skill>: unknown capability in requires: "<value>"` |
| Unknown slot name in `deep.slots` | `<skill>: unknown capability in deep.slots: "<value>"` |
| Capability provided but never required | `<cap>: WARNING — orphan capability` (informational, not error) |

### Protocol rules

| Rule | Error |
|------|-------|
| Unknown `emits` value | `<skill>: unknown protocol in emits: "<value>"` |
| Unknown `consumes` value | `<skill>: unknown protocol in consumes: "<value>"` |
| Unknown `accepts` / `emits` in tool manifest verbs | `<tool>: unknown protocol in verbs.<verb>.<field>: "<value>"` |
| Missing `schema.json` | `<protocol>: missing protocols/<name>/schema.json` |
| Missing `protocol.md` | `<protocol>: missing protocols/<name>/protocol.md` |
| Missing `validator.ts` | `<protocol>: missing protocols/<name>/validator.ts` |
| Missing `examples/valid` or `examples/invalid` (≥1 each) | `<protocol>: missing examples/valid/ or examples/invalid/ payloads` |
| Valid example fails ajv | `<protocol>: valid example <file> fails schema` |
| Invalid example passes ajv | `<protocol>: invalid example <file> passes schema (should fail)` |

### Validator rules

| Rule | Error |
|------|-------|
| `deep.validators` path missing | `<skill>: card validator not found: <path>` |
| `deep.validators` not executable | `<skill>: card validator not executable: <path>` |
| Protocol `validator.ts` not executable | `<protocol>: validator.ts not executable` |

### Subagent rules

| Rule | Error |
|------|-------|
| Missing required frontmatter (`name` / `model` / `description`) | `<subagent>: missing required field: <field>` |
| `name` ≠ filename stem | `<subagent>: frontmatter name "<X>" does not match filename` |
| Duplicate `name` across files | `duplicate subagent name: <name>` |
| Unknown `model` | `<subagent>: unknown model "<value>" (must be haiku, sonnet, or opus)` |
| Unknown `consumes` protocol | `<subagent>: unknown protocol in consumes: "<value>"` |
| Unknown `emits` protocol | `<subagent>: unknown protocol in emits: "<value>"` |
| Unknown `references` capability | `<subagent>: unknown capability in references: "<value>"` |
| Card's `deep.subagents` references missing subagent | `<skill>: unknown subagent in deep.subagents: "<name>"` |

### Legacy field rejection

Any of `source`, `composes`, `enhances`, `iron_laws`, or inline `deep.agents` (objects with prompt blocks)
→ hard error: `<skill>: legacy field "<name>" no longer supported (rename per SPEC-tagen)`.

---

## CLI flag reference

### Common to `list` / `demo` / `get`

| Flag | Type | Default | Notes |
|------|------|---------|-------|
| `--phase X` | repeatable | all | OR within dimension |
| `--domain X` | repeatable | all | OR within dimension |
| `--language X` | single | all | Inclusive: matches X OR `agnostic` |
| `--layer X` | repeatable | all | |
| `--concerns X` | repeatable | all | |
| `--capability X` | repeatable | all | Cards whose `provides` includes any |
| `--protocol X` | repeatable | all | Cards whose `emits` or `consumes` includes any |
| `--json` | flag | false | Machine-readable output |

### `list`-only

| Flag | Default | Notes |
|------|---------|-------|
| `--subagents` | false | List subagents instead of cards |

### `demo` / `get`

| Flag | Default | Notes |
|------|---------|-------|
| `--card NAME` | unset (repeatable) | Restrict matched set to listed cards exactly; bypasses tag filters; used to override slot resolution |
| `--verbose` (`demo`) | false | Print resolution trace |
| `--dry-run` (`get`) | false | Skip downstream protocol-schema check |

### Exit codes (uniform across commands)

| Code | Meaning |
|------|---------|
| 0 | Success (warnings allowed in `demo` / `get`) |
| 1 | Validation error or vocabulary mismatch |
| 2 | No matching cards (empty result set) |

---

## Edge case matrix

| Situation | `validate` | `demo` | `get` |
|-----------|------------|--------|-------|
| Unknown tag value | error 1 | error 1 | error 1 |
| Unknown capability in `provides`/`requires`/slot | error 1 | error 1 | error 1 |
| Unknown protocol in `emits`/`consumes` | error 1 | error 1 | error 1 |
| Missing validator path in `deep.validators` | error 1 | error 1 | error 1 |
| Unresolvable `deep.subagents` name | error 1 | error 1 | error 1 |
| Unmet `requires` (no provider in matched set) | not validate's concern | warning, exit 0 | warning, exit 0, manifest emitted |
| Unfilled slot | not validate's concern | warning, exit 0 | warning, exit 0, manifest emitted |
| Multiple providers for one capability in matched set | n/a | warning naming both, exit 0; first alphabetical wins | same; manifest's `slots[].fillerCard` = chosen, `slots[].candidates` = all |
| Empty matched set | exit 2 | exit 2 | exit 2 |
| Duplicate card `skill` | error 1 | error 1 | error 1 |
| Subagent filename ≠ `name` frontmatter | error 1 | error 1 | error 1 |
| Subagent unknown `model` | error 1 | error 1 | error 1 |
| Protocol dir missing schema/doc/validator | error 1 | error 1 | error 1 |
| Protocol dir missing examples/valid or examples/invalid | error 1 | error 1 | error 1 |
| Card uses legacy field (`source` / `composes` / `enhances` / `iron_laws` / inline `deep.agents`) | error 1 | error 1 | error 1 |
| `core.files` path missing on disk | error 1 | error 1 | error 1 |
| `deep.refs` path missing on disk | error 1 | error 1 | error 1 |

Errors block; warnings inform. The agent reads `manifest.warnings[]` and decides whether to proceed.

---

## Constraints

- **No config file.** Discovery is convention only (`skill-graph/vocabulary.yaml` marks the root).
- **No native bindings.** Pure TypeScript/JS; compiles anywhere Bun runs.
- **`yaml` is the only runtime dep.** Everything else is stdlib or Bun built-in.
- **Vocabularies + capabilities + protocols + subagents live in the marketplace**, never in tagen.
- **Query commands never write files.** Hard contract with the agent.
- **No transitive auto-resolution.** Tagen composes only from the matched set.
- **`tagen get --json` is a stable contract.** Manifest-shape changes need a dedicated PR + consumer updates.
- **`yaml` parses both YAML frontmatter and JSON Schemas (when read as text).** ajv is the marketplace's dep, not tagen's.
- **Bun runtime required for npm-based usage.** Standalone binary bypasses this.

---

## Change triggers

| Assumes | If this changes | Do |
|---------|-----------------|-----|
| Single-maintainer closed catalog | Third parties ship brain modules | Namespace capabilities/protocols (`qsm/review-artifact`); revisit Iron Law 9 (versioning) |
| `yaml` is the only runtime dep | Need TOML / JSON5 / binary | Add dep + parser abstraction; update this spec |
| Bun runtime available | Consumer can't install Bun | Document standalone-binary path as the Bun-less route |
| `tagen get` < 500ms on 100 cards | Catalog grows past 500 cards and exceeds 5s | Add an in-memory index per invocation; remain read-only |
| Single marketplace per invocation | Multi-marketplace composition needed | Add `--root` flag; namespace vocabularies per marketplace |
| Validators are out-of-process via stdin/exit | Need stateful validators | New SPEC; current model insufficient |
| Tags are 5 fixed dimensions | Need a 6th (e.g., `platform: github \| gitlab`) | Add to `vocabulary.yaml`; update validator + this spec |
| All slot providers can be enumerated, first alphabetical wins | Need a different selection strategy | Add `deep.slots.<cap>: { strategy: first \| all }`; default unchanged |
| JSON Schema draft-07 sufficient | Need draft-2020 / OpenAPI refs | Upgrade dialect; update validators |
| Manifest shape is stable | Consumer needs a new field | Add the field as optional first; bump after consumer PRs land |

---

## Testing strategy

- **Unit tests** (`__tests__/*.test.ts`): loaders (vocabulary / capabilities / protocols / subagents /
  catalog), `composeManifest()` (tag filter → cap collection → slot resolution → tier assembly),
  `validateCard`. Fixtures in `__tests__/fixtures/skill-graph/`.
- **Manifest contract test**: `tagen get --json` output validated against
  `docs/tagen-get-manifest.schema.json`. Breaking changes block merge.
- **BDD scenarios** (`features/*.feature`): one `.feature` per command (`validate.feature` /
  `list.feature` / `demo.feature` / `get.feature` / `tags.feature` / `add.feature`). End-to-end on
  the fixture skill-graph.
- **Edge cases** in `composer.test.ts`: empty match, unmet requires, conflicting providers, legacy
  fields rejected, missing paths.
- **Performance benchmarks** in CI on a 100-card fixture: `list` < 100ms, `validate` < 500ms,
  `get` < 500ms. Regression blocks merge.
- **No self-review.** External tools only — `biome check` + `bun:test` + `feats` + ajv schema
  validation.

---

## Operational readiness

### Install

```bash
bun add -D @questi0nm4rk/tagen          # devDep, invoke via bunx tagen
bun add -g @questi0nm4rk/tagen          # global, invoke via tagen
# or download the standalone binary from GitHub Releases
```

### First-run sanity

```bash
tagen tags          # prints all four vocabularies
tagen validate      # exit 0 on a clean marketplace
```

### CI integration

```bash
bunx tagen validate
```

One job, < 3s on a 60-card catalog. Non-zero exit blocks merge.

### Contributor workflow (adding a composable card)

1. Create `brain/<module>/` (refs + validators).
2. Create `skill-graph/skills/<module>.md` with `provides` / `requires` / `emits` / `consumes` / tiers / validators.
3. Add any new capability to `skill-graph/capabilities.yaml` and any new protocol to `skill-graph/protocols/<name>/`.
4. `bunx tagen validate` — fix errors.
5. `bunx tagen demo --tags <relevant>` — verify composition resolves.
6. Commit card + brain + vocabulary updates together.

### Agent workflow (typical task)

1. `bunx tagen list --domain <d> --language <l>` — discover.
2. `bunx tagen demo --tags …` — preview composition (optional).
3. `bunx tagen get --tags … --json` — pull the manifest.
4. Read `core[]` into context.
5. Dispatch each subagent in `subagents[]` with its `prompt` and `model`; each emits an artifact
   per its `emits`.
6. Pipe each artifact through `validators.protocol[]` first (schema), then matching
   `validators.card[]` (methodology). All exit 0 → pass.
7. Stamp `validated_by: <hash>` on the artifact. Match `emits` against installed tool
   `verbs.*.accepts`; invoke the tool with the signed payload.

### Diagnostics

- `tagen validate --verbose` — per-card per-rule trace.
- `tagen demo --verbose` — resolution trace.
- `tagen get --dry-run` — manifest to stdout, warnings to stderr, no schema check.
- `tagen list --filter capability=<name>` — find producers / consumers.

### Error reporting

All errors print to stderr with a `tagen:` prefix. Exit 0 = success, 1 = user error or validation failure, 2 = no matches.

### Recovery

Vocabulary files are git-tracked. `git revert` undoes a bad addition. There is no persistent state for tagen to corrupt.

---

## Cross-references

- **qsm-marketplace2 CLAUDE.md** — Iron Laws + four-layer architecture (brain / subagents / tools /
  agent) + tool shapes (FLOOR / FULL) + add-X workflows.
- **qsm-marketplace2 SPEC-008** — three-layer architecture this query layer serves (referenced in
  qsm-marketplace2's own spec set).
- **qsm-marketplace2 `docs/backlog.md`** — `[infra-1]` tracks tagen v2 ship as the blocker for slash
  commands invoking `tagen get`.

---

## Open questions

- Should the manifest include tool-plugin matching hints (`a tool installed on this machine accepts
  review-artifact on verb post-review`)? Avoids forcing the agent to query the plugin system
  separately. Out of scope for the first ship; revisit when tools are wired through tagen.
- Should `capabilities.yaml` carry per-capability descriptions for `tagen tags` output? Zero-cost
  addition; lean yes.
- Should `tagen validate` have a `--fix` mode suggesting Levenshtein-near tag values for typos?
  Nice-to-have; not blocking.
- Should `protocols/*.json` schemas support `$ref` across protocol files (e.g., `review-artifact`
  embedding `finding`)? JSON Schema supports it; document conventions when the first cross-protocol
  reference shows up.
