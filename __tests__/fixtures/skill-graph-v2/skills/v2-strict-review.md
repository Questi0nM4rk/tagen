---
skill: v2-strict-review
plugin: qsm-strict-review
description: "Zero-tolerance PR/MR review — every finding is a required change, one tier, no partial approvals."
tags:
  phase: [review]
  domain: [code-review]
  language: agnostic
  layer: methodology
  concerns: [review-automation, quality]
provides: [review-methodology]
requires: [language-patterns]
emits: [graded-findings]
consumes: [finding, recon-summary]
surface:
  triggers:
    - "review PR"
    - "strict review"
core:
  files:
    - refs/workflow.md
deep:
  subagents:
    - v2-domain-reviewer
  slots:
    language-patterns: true
  validators:
    - validators/no-emoji.ts
---

# Strict Review

Zero-tolerance PR/MR review methodology. Every finding is a required change.
There are no severity tiers — every observation either blocks or it does not exist in the report.
