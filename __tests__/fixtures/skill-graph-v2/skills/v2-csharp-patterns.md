---
skill: v2-csharp-patterns
plugin: qsm-dotnet-review
description: "C# / .NET language-specific review patterns for strict-review slot filling."
tags:
  phase: [review]
  domain: [code-review]
  language: dotnet
  layer: reference
  concerns: [review-automation, standards-enforcement]
provides: [language-patterns]
requires: []
emits: []
consumes: []
surface:
  triggers:
    - "C# review"
    - "dotnet review"
core:
  files:
    - refs/csharp-patterns.md
deep:
  subagents: []
  slots: {}
  validators: []
---

# C# Patterns

Language-specific review patterns for C# and .NET projects.
Covers naming conventions, async usage, nullable reference types, and EF Core query rules.
