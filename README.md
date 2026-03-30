# tagen

Skill-graph CLI for qsm-marketplace: resolve tag queries, assemble plugins, validate vocabulary.

[![npm version](https://img.shields.io/npm/v/tagen)](https://www.npmjs.com/package/tagen)
[![CI](https://github.com/Questi0nM4rk/tagen/actions/workflows/ci.yml/badge.svg)](https://github.com/Questi0nM4rk/tagen/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Install

```bash
bun add -g tagen
# or
npm install -g tagen
```

---

## Commands

| Command | Example | Description |
|---------|---------|-------------|
| `list` | `tagen list` | List all catalog cards |
| `list` | `tagen list --filter language=python` | Filter by tag |
| `tags` | `tagen tags` | Print controlled vocabulary |
| `resolve` | `tagen resolve --phase implementation --language typescript` | Match skills by tag query |
| `validate` | `tagen validate` | Check all card tags against vocabulary.yaml |
| `sync` | `tagen sync` | Find skill files not registered in build.yaml |
| `add` | `tagen add` | Scaffold a new catalog card |
| `build` | `tagen build --plugin qsm-python-lang` | Assemble a plugin from tag queries |
| `build` | `tagen build --all` | Assemble all plugins |
| `diff` | `tagen diff --all` | Check if plugin output is in sync with catalog |

---

## Usage as devDependency

In a marketplace repo:

```json
{
  "devDependencies": {
    "tagen": "latest"
  }
}
```

```bash
bun install
bunx tagen validate
bunx tagen build --all
bunx tagen diff --all     # CI gate: exits non-zero if output is stale
```

---

## How It Works

Tagen walks up from `cwd` to find `skill-graph/vocabulary.yaml`. No config file needed. Catalog cards live in `skill-graph/skills/*.md`. Plugins are assembled from `plugins/<name>/build.yaml` tag queries.

See [docs/specs/](docs/specs/) for architecture decisions.

---

## Contributing

Fork → branch → PR. `ai-guardrails` enforces conventional commits and blocks direct commits to main.

```bash
bun test                   # must be green
bun run typecheck          # must be clean
```
