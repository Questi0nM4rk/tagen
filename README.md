# tagen

Skill-graph CLI for qsm-marketplace: resolve tag queries, compose skills into a JSON manifest, validate vocabulary.

[![npm version](https://img.shields.io/npm/v/%40questi0nm4rk%2Ftagen)](https://www.npmjs.com/package/@questi0nm4rk/tagen)
[![CI](https://github.com/Questi0nM4rk/tagen/actions/workflows/ci.yml/badge.svg)](https://github.com/Questi0nM4rk/tagen/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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
| `tags` | `tagen tags` | Print controlled vocabulary |
| `validate` | `tagen validate` | Check all cards, protocols, and subagents against vocabulary |
| `list` | `tagen list` | List all catalog cards |
| `list` | `tagen list --filter language=python` | Filter by tag |
| `demo` | `tagen demo --language dotnet` | Preview a composition (matched cards + slot fills + warnings) |
| `get` | `tagen get --language dotnet --json` | Resolve a composition into a JSON manifest |
| `add` | `tagen add` | Scaffold a new catalog card interactively |

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
bunx tagen get --domain code-review --language dotnet --json
```

---

## How It Works

Tagen walks up from `cwd` to find `skill-graph/vocabulary.yaml`. No config file needed.
Catalog cards live in `skill-graph/skills/*.md`. The agent calls `tagen get` to resolve a
composition into a JSON manifest naming brain files, subagents, and validators to load.

See [docs/specs/SPEC-tagen.md](docs/specs/SPEC-tagen.md) for the full spec.

---

## Contributing

Fork → branch → PR. `ai-guardrails` enforces conventional commits and blocks direct commits to main.

```bash
bun test                   # must be green
bun run typecheck          # must be clean
```
