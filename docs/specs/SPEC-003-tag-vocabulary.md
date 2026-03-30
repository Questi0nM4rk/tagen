# SPEC-003: Controlled Tag Vocabulary

**Status:** Active
**Commands:** `tagen tags`, `tagen validate`, `tagen list --filter`

---

## Overview

Every catalog card in `skill-graph/skills/*.md` must be tagged across five dimensions. The controlled vocabulary defines all valid values. `tagen validate` checks cards against `vocabulary.yaml`, failing on any unknown value or missing required dimension.

The vocabulary lives in the marketplace (`skill-graph/vocabulary.yaml`), not in tagen. Tagen reads it from the discovered vault directory. New values are added to `vocabulary.yaml` in the marketplace; no tagen release is required.

---

## Iron Laws

1. **One value per concept** — WHY: synonyms split the graph; `api` and `web-api` would never appear together in the same query result.
2. **Required dimensions must be present on every card** — WHY: cards missing phase/domain/language/layer cannot be correctly resolved or filtered; they silently disappear from queries.
3. **Unknown values are errors, not warnings** — WHY: typos in tags (`tesitng` instead of `testing`) produce silently empty query results; fail loud on first occurrence.
4. **Vocabulary lives in the marketplace** — WHY: it evolves with content, not with the tool; adding a new domain value should not require a tagen release.
5. **Language is single-valued** — WHY: a skill is either language-specific or agnostic; "applies to both TypeScript and Python" means it should be split into two cards or made agnostic.

### DON'Ts

- **DON'T add synonyms** — WHY: `web-scraping` and `scraping` are the same concept; pick one, use it everywhere, document the choice here.
- **DON'T allow unknown values to pass validation** — WHY: silent graph corruption is worse than a build error; missing tags mean missing skills in plugin assembly.
- **DON'T make concerns required** — WHY: it's a cross-cutting overlay, not a primary classifier; forcing it adds noise without improving resolution accuracy.
- **DON'T use arrays for language or layer** — WHY: these are singular classifiers; a skill that is "both dotnet and typescript" needs to be split or made agnostic.

---

## Dimensions

### phase (required, array or string, ordered)

Represents the SDLC phase where the skill is most relevant.

| Value | Meaning |
|-------|---------|
| `planning` | Backlog, estimation, scope definition |
| `design` | Architecture, system design, ADRs |
| `specification` | Specs, acceptance criteria, contract definition |
| `implementation` | Writing production code |
| `testing` | Writing and running tests |
| `verification` | Type-check, lint, integration validation |
| `review` | Code review, PR review |
| `documentation` | Docs, changelogs, README |
| `operations` | Deployment, monitoring, incident response |

Cards may have multiple phases (e.g. `[implementation, testing]`).

### domain (required, array or string)

The technical area the skill addresses.

| Value | Meaning |
|-------|---------|
| `architecture` | System structure, component design, ADRs |
| `domain-modeling` | DDD aggregates, value objects, bounded contexts |
| `testing` | Test strategy, test patterns, test doubles |
| `data-access` | ORM, migrations, repository pattern |
| `api` | REST/gRPC/GraphQL API design and implementation |
| `validation` | Input validation, schema enforcement |
| `diagnostics` | Debugging, profiling, tracing |
| `workflow` | Development process, CI/CD, automation |
| `knowledge-management` | Vaults, notes, RAG, semantic search |
| `agent-design` | Agent architectures, prompt engineering |
| `code-review` | Review automation, PR standards |
| `quality` | Code quality, static analysis, linting |
| `tooling` | Developer tooling, CLI tools |
| `web-scraping` | HTTP scraping, browser automation for data |
| `data-processing` | Transformation, pipeline, format conversion |
| `database` | SQL, NoSQL, query tools, schema management |

Cards may have multiple domains (e.g. `[testing, quality]`).

### language (required, single string)

The programming language the skill targets.

| Value | Meaning |
|-------|---------|
| `agnostic` | Applies to any language; methodology or tooling |
| `dotnet` | C# / .NET specific |
| `typescript` | TypeScript / JavaScript specific |
| `python` | Python specific |

Must be a single string, not an array. If a skill applies to all languages, use `agnostic`. If it applies to two specific languages, split it into two cards.

**Resolution behavior:** `tagen resolve --language python` matches cards with `language: python` OR `language: agnostic`. `tagen build` with `language: python` matches ONLY `language: python` (exact).

### layer (required, single string, ordered)

The architectural layer of the skill within the plugin system.

| Value | Meaning |
|-------|---------|
| `orchestrator` | Composes and delegates to other skills; high-level workflow |
| `methodology` | Process methodology (TDD, BDD, DDD); language-agnostic |
| `reference` | Reference material, lookup tables, cheat sheets |
| `standards` | Coding standards, review rules, iron laws |
| `patterns` | Reusable implementation patterns |
| `analysis` | Analysis, diagnosis, investigation |
| `integration` | External system integration, API clients |
| `utility` | Low-level helpers, format conversion, CLI wrappers |

Must be a single string. The ordered list reflects increasing specificity.

### concerns (optional, array)

Cross-cutting concerns the skill addresses. Used for fine-grained filtering and discovery, not for plugin assembly queries.

| Value | Meaning |
|-------|---------|
| `feature-decomposition` | Breaking features into tasks/stories |
| `integration-analysis` | Analyzing cross-component dependencies |
| `quality` | Quality gates, metrics, thresholds |
| `testing` | Testing concerns (overlaps with domain:testing) |
| `performance` | Performance analysis, optimization |
| `security` | Security review, threat modeling |
| `error-handling` | Error propagation, recovery, reporting |
| `documentation` | Documentation generation or standards |
| `code-generation` | Code scaffolding, template generation |
| `review-automation` | Automated review checks, hook enforcement |
| `knowledge-capture` | Capturing decisions, learnings, patterns |
| `agent-orchestration` | Multi-agent coordination |
| `context-management` | Context window management, compaction |
| `task-management` | Task tracking, Jira, issue management |
| `standards-enforcement` | Enforcing coding/process standards |
| `plan-lifecycle` | Plan creation, execution, completion |
| `cli-tooling` | CLI tool usage patterns |
| `json-output` | Producing or consuming structured JSON |

---

## Validation Rules

`tagen validate` checks every card in `skill-graph/skills/` against `vocabulary.yaml`:

| Rule | Error |
|------|-------|
| `phase` missing | `<skill>: missing required dimension: phase` |
| `domain` missing | `<skill>: missing required dimension: domain` |
| `language` missing | `<skill>: missing required dimension: language` |
| `layer` missing | `<skill>: missing required dimension: layer` |
| Unknown phase value | `<skill>: unknown phase value: "specifikation"` |
| Unknown domain value | `<skill>: unknown domain value: "web-api"` |
| Unknown language value | `<skill>: unknown language value: "rust"` |
| Unknown layer value | `<skill>: unknown layer value: "helper"` |
| Unknown concerns value | `<skill>: unknown concerns value: "observability"` |
| `language` is array | `<skill>: language must be a single string, not an array` |
| `layer` is array | `<skill>: layer must be a single string, not an array` |

Exit code is non-zero if any error is found. All errors are printed before exiting (not fail-fast).

---

## Relationships

Cards may declare relationships to other skills:

```yaml
composes: [design, bdd-workflow, tdd-workflow]
enhances: [spec-driven, external-review]
```

| Field | Meaning |
|-------|---------|
| `composes` | This skill orchestrates or delegates to the listed skills. The listed skills are subordinate nodes. |
| `enhances` | This skill adds value when combined with the listed skills. Neither is subordinate. |

Relationships are informational — `tagen validate` checks that referenced skills exist, but relationships do not affect query resolution or plugin assembly.

---

## vocabulary.yaml Location and Ownership

`vocabulary.yaml` lives at `skill-graph/vocabulary.yaml` in the marketplace repo. Tagen discovers it by walking up from CWD looking for `skill-graph/vocabulary.yaml`.

**Ownership:** The marketplace owns the vocabulary. Tagen reads and validates against it. No tagen release is needed to add new values — edit `vocabulary.yaml` and run `tagen validate`.

**Format:**
```yaml
phase:
  - planning
  - design
  - specification
  - implementation
  - testing
  - verification
  - review
  - documentation
  - operations

domain:
  - architecture
  - domain-modeling
  # ...etc

language:
  - agnostic
  - dotnet
  - typescript
  - python

layer:
  - orchestrator
  - methodology
  - reference
  - standards
  - patterns
  - analysis
  - integration
  - utility

concerns:
  - feature-decomposition
  # ...etc
```

---

## Adding New Vocabulary Values

1. Add the value to `skill-graph/vocabulary.yaml` in the marketplace
2. Add to the appropriate section of this SPEC's dimension tables
3. Update the evolution table below
4. Run `tagen validate` to confirm no existing cards use the old spelling
5. No tagen version bump required

---

## Evolution

| Date | Change |
|------|--------|
| Initial | 5 dimensions: phase (9), domain (16), language (4), layer (8), concerns (18) |
| — | Add `web-scraping`, `data-processing`, `database` to domain |
| — | Add `cli-tooling`, `json-output` to concerns |
