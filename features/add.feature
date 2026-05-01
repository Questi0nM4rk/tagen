Feature: tagen add — interactive scaffold

  Scenario: --help mentions add
    Given the canonical fixture brain
    When I run tagen with args --help
    Then it exits 0
    And stdout contains "add"

  # End-to-end interactive scaffolding is exercised by __tests__/add.test.ts
  # (unit-level, in-process readline). Bun's readline + piped stdin gobbles
  # multiple buffered lines unreliably, so a subprocess BDD scenario adds no
  # signal beyond the unit test.
