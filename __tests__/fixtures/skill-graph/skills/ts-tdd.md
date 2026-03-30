---
skill: ts-tdd
plugin: qsm-typescript-lang
source: plugins/qsm-typescript-lang/skills/ts-tdd/SKILL.md
description: "Use when writing TypeScript tests with bun:test or vitest."
tags:
  phase: [implementation, testing]
  domain: [testing]
  language: typescript
  layer: standards
  concerns: [testing]
iron_laws:
  - "Use bun:test for Bun projects — WHY: native, zero config"
  - "Type your test fixtures — WHY: catches shape errors at compile time"
composes: [tdd-workflow]
enhances: []
---

# TypeScript TDD

TypeScript-specific test patterns using bun:test.

## Iron Laws
1. **Use bun:test for Bun projects** — WHY: native, zero config, no jest compat shims
2. **Type your test fixtures** — WHY: catches shape errors at compile time
