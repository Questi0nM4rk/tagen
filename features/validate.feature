Feature: tagen validate — catalog card consistency checks

  Scenario: valid catalog passes
    Given a skill-graph with catalog cards
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

  Scenario: card with unknown capability in provides fails
    Given a catalog card with an unknown capability in provides
    When I run "tagen validate"
    Then it exits non-zero
    And it prints an error containing "unknown capability in provides"

  Scenario: card with missing core.files path fails
    Given a card with a core.files entry that does not exist on disk
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

  Scenario: card without description hard-errors
    Given a card whose frontmatter omits description
    When I run "tagen validate"
    Then it exits non-zero
    And it prints an error containing "missing required field: description"

  Scenario: legacy composes field hard-errors
    Given a card whose frontmatter contains 'composes'
    When I run "tagen validate"
    Then it exits non-zero
    And it prints an error containing "legacy field 'composes'"

  Scenario: legacy source field hard-errors
    Given a card whose frontmatter contains 'source'
    When I run "tagen validate"
    Then it exits non-zero
    And it prints an error containing "legacy field 'source'"
