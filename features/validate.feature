Feature: tagen validate — catalog card consistency checks

  Scenario: valid catalog passes
    Given a skill-graph with valid catalog cards
    When I run "tagen validate"
    Then it exits 0
    And it prints "All N cards valid"

  Scenario: unknown tag value fails
    Given a catalog card with phase: [invalid-phase]
    When I run "tagen validate"
    Then it exits non-zero
    And it prints an error containing "unknown phase value"

  Scenario: unknown language value fails
    Given a catalog card with language: ruby
    When I run "tagen validate"
    Then it exits non-zero
    And it prints an error containing "unknown language value"

  # ── v2 scenarios ─────────────────────────────────────────────────────────────

  Scenario: card with unknown capability in provides fails
    Given a catalog card with an unknown capability in provides
    When I run "tagen validate"
    Then it exits non-zero
    And it prints an error containing "unknown capability in provides"

  Scenario: card with missing core.files path fails
    Given a v2 card with a core.files entry that does not exist on disk
    When I run "tagen validate"
    Then it exits non-zero
    And it prints an error containing "path not found"

  Scenario: protocol missing schema.json fails
    Given a protocol directory without schema.json
    When I run "tagen validate"
    Then it exits non-zero
    And it prints an error containing "missing schema.json"

  Scenario: subagent name does not match filename fails
    Given a subagent whose frontmatter name differs from its filename
    When I run "tagen validate"
    Then it exits non-zero
    And it prints an error containing "does not match filename"

  Scenario: subagent with unknown model fails
    Given a subagent with an unknown model value
    When I run "tagen validate"
    Then it exits non-zero
    And it prints an error containing "unknown model"

  Scenario: v1-only card passes with deprecation warnings
    Given a v1-only catalog card with iron_laws and composes fields
    When I run "tagen validate"
    Then it exits 0
    And it prints a deprecation warning
