# tagen

Read-only CLI that walks a `brain/<type>/<name>/` directory tree of typed cards
and emits a JSON composition manifest naming everything an agent should load
for a task.

[![npm version](https://img.shields.io/npm/v/%40questi0nm4rk%2Ftagen)](https://www.npmjs.com/package/@questi0nm4rk/tagen)
[![CI](https://github.com/Questi0nM4rk/tagen/actions/workflows/ci.yml/badge.svg)](https://github.com/Questi0nM4rk/tagen/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

The directory tree IS the vocabulary — no `vocabulary.yaml`, no
`capabilities.yaml`, no `tags:` / `provides:` / `emits:` / `consumes:`.
Five frontmatter fields total: `description`, `aliases`, `requires`,
`subagents`, `model`.

---

## Install

```bash
bun add -g @questi0nm4rk/tagen
# or
npm install -g @questi0nm4rk/tagen
```

---

## Commands

| Command | Example | Description |
|---------|---------|-------------|
| `list` | `tagen list` | List every card as `<type>/<name>` |
| `list` | `tagen list --type lang --aliases` | Filter to one type, show aliases |
| `validate` | `tagen validate` | Walk the tree, report every rule violation; exit non-zero on any |
| `get` | `tagen get strict csharp --json` | Resolve a composition into a JSON manifest |
| `get` | `tagen get methodology` | Bare type-name positional triggers browse intent |
| `get` | `tagen get strict csharp python --pin lang=python --json` | Override alphabetical-first slot fill |
| `add` | `tagen add` | Interactive scaffold for a new card (only writer) |

All commands are read-only except `add`.

---

## Usage as devDependency

In a marketplace repo:

```json
{
  "devDependencies": {
    "@questi0nm4rk/tagen": "latest"
  }
}
```

```bash
bun install
bunx tagen validate
bunx tagen get strict csharp --json | jq .
```

---

## How It Works

Tagen walks up from `cwd` to find a `brain/` directory containing at least one
`<type>/<name>/CORE.md`. No config file. Each card carries optional
`references/` (pull-on-demand long-form), and review/methodology cards may
ship `validators/` (executable scripts) plus a `lib/` for shared modules.

`tagen get`:

1. Fuzzy-matches positional args to `<type>/<name>` (3-char min; exact > prefix > substring > Levenshtein).
2. Resolves `requires: [<type>]` slots by picking a matched card under that type — alphabetical first, `--pin <type>=<name>` overrides.
3. Collects subagents declared by review/methodology cards, plus their `validators/*.ts`.
4. Emits a JSON manifest with all paths root-relative, so the agent resolves them as `root + "/" + path`.

See [docs/specs/SPEC-tagen.md](docs/specs/SPEC-tagen.md) for the full spec
and [docs/tagen-get-manifest.schema.json](docs/tagen-get-manifest.schema.json)
for the manifest contract.

---

## Contributing

Fork → branch → PR. `ai-guardrails` enforces conventional commits and blocks direct commits to main.

```bash
bun test                   # must be green
bun run typecheck          # must be clean
bun run lint               # must be clean
```
