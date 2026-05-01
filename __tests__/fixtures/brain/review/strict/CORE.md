---
description: "Zero-tolerance PR review — every finding is a required change."
requires: [lang]
subagents: [security-reviewer, style-reviewer]
---

# Strict Review

Dispatch each subagent against its diff partition. Pipe outputs through every
script in `validators[]`.
