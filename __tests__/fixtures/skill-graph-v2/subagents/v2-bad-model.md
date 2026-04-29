---
name: v2-bad-model
model: gpt4
description: "Subagent with an unknown model value — used to test model validation."
consumes: []
emits: []
references: []
---

# Bad Model Subagent

This subagent exists solely to test model validation.
The `model` field above (`gpt4`) is not a valid value; only `haiku`, `sonnet`, and `opus` are accepted.
