---
skill: tdd-workflow
plugin: qsm-methodology
source: plugins/qsm-methodology/skills/tdd-workflow/SKILL.md
description: "Use when implementing features using test-driven development."
tags:
  phase: [implementation, testing]
  domain: [testing]
  language: agnostic
  layer: methodology
  concerns: [testing, quality]
iron_laws:
  - "Test before code — WHY: forces interface design before implementation"
  - "One assertion per test — WHY: pinpoints failures without noise"
  - "Never skip RED — WHY: proves the test actually fails before the fix"
composes: []
enhances: [bdd-workflow]
---

# TDD Workflow

Run the RED-GREEN-REFACTOR cycle on every feature.

## Iron Laws
1. **Test before code** — WHY: forces thinking about the interface before writing it
2. **One assertion per test** — WHY: a failing test tells you exactly what broke
3. **Never skip RED** — WHY: a test that never fails proves nothing
