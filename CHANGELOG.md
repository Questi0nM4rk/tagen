# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-05-01

### Features

- Initial tagen CLI — skill-graph assembler for Claude Code plugins
- [**breaking**] Phase 3 — SPEC-tagen CLI flags on list/demo/get/validate
- Phase 4 — output formatting per SPEC-tagen layouts
- Phase 5 — validator layering with executability + ajv example checks
- Phase 6 — performance benchmarks (100-card budget)
- Implement issues #17 #18 #19 #23 with command-level tests (#24)
- **phase-1:** Strip dead surface — delete demo + tags commands and --dry-run (#26)
- **phase-2:** Replace data layer with brain/<type>/<name>/ shape (#27)

### Bug Fixes

- Scope package as @questi0nm4rk/tagen (npm name conflict)
- Add missing shebang to npm bundle output (#2)
- Diff exit code, codespell ignores, version update guard (#7)
- **cli:** Validate command name before findVaultDir()
- **tests:** Unblock CI — ajv dialect, schema, and v1/v2 card literals
- **tests:** Point capabilities.test at canonical skill-graph fixture
- **validate:** Support draft 2020-12 schemas + don't crash on bad schema (#29)

### Refactor

- [**breaking**] Phase 1 — drop build/diff/resolve/sync; pin bun via mise
- [**breaking**] Phase 2 — strip v1 fields, hard-error legacy, single fixture

### Documentation

- Consolidate SPEC-001/002/003/004 into single SPEC-tagen.md
- **claude:** Note dual fixture layout (clean + with-issues + brain stubs)
- **spec:** Clarify slot-filler content routing — core[] vs refs[] (#22)
- **spec:** Replace SPEC-tagen with directory-tree vocabulary model (#25)
- **phase-3:** Rewrite README for new brain/<type>/<name>/ shape (#28)

### Chore

- Add cc-review automated PR reviewer
- Grant WebSearch + WebFetch to cc-review workflow (#10)
- Baseline partial v2 implementation
- Add ajv to devDependencies
- Add stderr trace in loadCapabilities to diagnose CI
