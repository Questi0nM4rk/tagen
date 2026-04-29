# Protocol: finding

A single review finding produced by a domain reviewer subagent.
Required fields: `file` (string path) and `line` (integer >= 1).
Optional field: `description` (imperative-mood string, no severity labels, no emoji).
Consumed by: `review-validator` subagent and card-level validators.
