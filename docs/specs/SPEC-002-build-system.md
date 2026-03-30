# SPEC-002: Build System & Plugin Assembly

**Status:** Active
**Commands:** `tagen build`, `tagen diff`

---

## Overview

The build system resolves tag queries defined in `build.yaml` files against the catalog of skill cards, then writes assembled plugin output to disk. Diff checks whether the assembled output is in sync with current catalog content.

---

## Iron Laws

1. **build.yaml is the plugin source of truth** — WHY: it declaratively describes what goes in a plugin via tag queries; the assembled output is always reproducible from it.
2. **Content hash before write** — WHY: prevents spurious file modifications that trigger unnecessary git diffs and version prompts.
3. **Language filter in build is EXACT** — WHY: a plugin for `language: python` should not silently absorb `language: agnostic` cards; agnostic cards belong to the methodology plugin, not language-specific ones.
4. **Last write wins on deduplication** — WHY: predictable, simple; skills appearing in multiple queries are not duplicated, and the last query's match is the canonical one.
5. **Marketplace.json is generated, not hand-maintained** — WHY: it would drift from reality; generating it on every build keeps it always accurate.
6. **Version bumps are interactive, not automatic** — WHY: automated semver guessing gets it wrong; the author knows whether a content change is patch, minor, or major.

### DON'Ts

- **DON'T use mtime for change detection** — WHY: mtime is environment-dependent; content hash is the only stable signal.
- **DON'T merge duplicate skills across queries** — WHY: last-write-wins is simpler and the expected behavior when queries overlap.
- **DON'T silently skip validation errors** — WHY: a card with invalid tags that matches a query would produce corrupted plugin output; fail loud.
- **DON'T write plugin.json by hand** — WHY: it's generated from build.yaml metadata; hand-editing it drifts from the source.

---

## build.yaml Format

```yaml
name: qsm-python-lang         # Plugin name (e.g. "qsm-python-lang")
version: 1.0.0                # Semver; bumped interactively when content changes
description: "Python TDD, BDD, DDD, and verification skills"
author:
  name: qsm
keywords: [python, tdd, bdd, ddd]

queries:
  - tags:
      phase: implementation
      language: python
      domain: [testing, domain-modeling]
  - tags:
      phase: verification
      language: python

include: []       # Skill names to always include, regardless of query results
exclude: []       # Skill names to never include, even if a query matches

hooks: null       # Path to hand-maintained hooks.json, or null
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Plugin identifier; used in output paths |
| `version` | string | yes | Semver; updated interactively on content change |
| `description` | string | yes | Human-readable summary |
| `author.name` | string | yes | Author identifier |
| `keywords` | string[] | yes | For marketplace.json discovery |
| `queries` | BuildQuery[] | yes | Tag queries (can be empty if using `include` only) |
| `include` | string[] | no | Skill names always included |
| `exclude` | string[] | no | Skill names always excluded |
| `hooks` | string \| null | no | Relative path to hooks.json |

### BuildQuery Type

```typescript
interface BuildQuery {
  tags: Partial<Record<"phase" | "domain" | "language" | "layer" | "concerns", string | string[]>>;
}
```

---

## Resolution Algorithm

Given a `build.yaml`, the resolution pipeline is:

```
1. Load all catalog cards from skill-graph/skills/*.md
2. For each query in queries[]:
     resolved = strictFilterCards(allCards, query.tags)
     add resolved cards to Map<skillName, card>  (last write wins)
3. For each name in include[]:
     find card by skill name, add to Map
4. For each name in exclude[]:
     remove from Map
5. Final set = Map.values()
```

### strictFilterCards

Filters cards using AND across dimensions, OR within a dimension:

```typescript
function strictFilterCards(cards: CatalogCard[], query: BuildQuery["tags"]): CatalogCard[] {
  return cards.filter(card => {
    for (const [dim, queryVal] of Object.entries(query)) {
      const cardVal = card.tags[dim];
      if (!cardVal) return false;

      const queryArr = Array.isArray(queryVal) ? queryVal : [queryVal];
      const cardArr  = Array.isArray(cardVal)  ? cardVal  : [cardVal];

      // AND: every queryArr value must appear in cardArr
      if (!queryArr.every(v => cardArr.includes(v))) return false;
    }
    return true;
  });
}
```

### Language Filter: EXACT vs. resolve

- **`tagen build`**: `language: python` matches ONLY cards with `language: python`. Does not include `language: agnostic`.
- **`tagen resolve`**: `language: python` matches cards with `language: python` OR `language: agnostic`. Agnostic skills are universally applicable.

This distinction is intentional. Build queries are for plugin assembly (precise inclusion). Resolve queries are for discovery (inclusive).

---

## Content Hash

The content hash is a SHA-256 digest computed from the resolved skill set:

```typescript
function computeHash(cards: CatalogCard[]): string {
  const sorted = [...cards].sort((a, b) => a.skill.localeCompare(b.skill));
  const content = sorted.map(c => c.body).join("\n---\n");
  return crypto.createHash("sha256").update(content).digest("hex");
}
```

- Sorted by skill name: order-independent
- Only skill body (frontmatter stripped): metadata changes don't trigger rebuilds
- Stored in `.build-hash` in the plugin root
- If stored hash matches computed hash: print `<plugin>: up to date`, skip writes

---

## Plugin Output Structure

```
plugins/<name>/
├── build.yaml                    # Unchanged (source of truth for queries)
├── .build-hash                   # SHA-256 of resolved skill bodies
├── .claude-plugin/
│   └── plugin.json               # Generated from build.yaml metadata
└── skills/
    └── <skill-name>/
        ├── SKILL.md              # Generated: frontmatter + Iron Laws summary + reference table
        └── references/
            └── <skill-name>.md   # Copied: full body from catalog card
```

### plugin.json Generation

Generated from `build.yaml` fields:

```json
{
  "name": "qsm-python-lang",
  "version": "1.0.0",
  "description": "Python TDD, BDD, DDD, and verification skills",
  "author": { "name": "qsm" },
  "keywords": ["python", "tdd", "bdd", "ddd"]
}
```

Hooks are not set in `plugin.json`. They are auto-discovered from `hooks/hooks.json` by the CC harness.

### SKILL.md Generation

Each resolved skill gets a `SKILL.md` with frontmatter, Iron Laws summary, and a reference table:

```markdown
---
name: python-tdd
description: "This skill should be used when writing Python tests using pytest..."
---

# Python TDD

## Iron Laws
1. Test before code — WHY: RED-GREEN-REFACTOR is the only safe path to confidence.
2. One assertion per test — WHY: failing tests must pinpoint the cause without ambiguity.
...

## DON'Ts
- DON'T test private methods — WHY: tests coupled to internals break on every refactor.
...

## References
| File | Tags | Load When |
|------|------|-----------|
| references/python-tdd.md | phase:implementation, language:python, domain:testing | Writing Python tests |
```

The references table summarizes the card's tags and description as a load-when hint for the CC harness.

### references/<skill>.md

Verbatim copy of the catalog card body (everything after the YAML frontmatter block). Not modified.

---

## Version Bumping

When the content hash changes (new or modified skills), tagen prompts:

```
qsm-python-lang: content changed (hash mismatch)
Current version: 1.0.2
Bump type? [patch/minor/major/skip]: _
```

- `patch`: 1.0.2 → 1.0.3 (new/updated skill content, no API change)
- `minor`: 1.0.2 → 1.1.0 (new skills added)
- `major`: 1.0.2 → 2.0.0 (breaking structural change)
- `skip`: no version change, hash still updated

**`--no-bump` flag**: skips all prompts, no version change. Used in CI and `--all` scripted runs.

The updated version is written back to `build.yaml` using string replacement (preserves formatting and comments).

---

## marketplace.json Generation

After all plugins are built, `tagen build --all` writes `.claude-plugin/marketplace.json` in the repo root:

```json
[
  {
    "name": "qsm-python-lang",
    "source": "plugins/qsm-python-lang",
    "description": "Python TDD, BDD, DDD, and verification skills",
    "version": "1.0.0",
    "author": { "name": "qsm" },
    "keywords": ["python", "tdd", "bdd", "ddd"]
  },
  ...
]
```

Aggregated from all `build.yaml` files found under `plugins/`. Hand-maintained plugins (no `build.yaml`) are excluded.

---

## diff Command

`tagen diff [--plugin <name>] [--all]`

Recomputes what the build would produce and compares it to what's on disk:

1. Run resolution algorithm (same as build, no writes)
2. Compute content hash
3. Compare to `.build-hash` on disk
4. If mismatch: print `<plugin>: OUT OF SYNC` and exit non-zero
5. If match: print `<plugin>: in sync`

Use case: CI gate to ensure committed plugin output is not stale.

```bash
# In CI:
bunx tagen diff --all || (echo "Run tagen build --all and commit" && exit 1)
```

---

## Evolution

| Version | Change |
|---------|--------|
| 0.1.0 | Initial build + diff implementation |
| — | Add `--no-bump` flag |
| — | marketplace.json generation |
| — | Interactive version bump prompt |
