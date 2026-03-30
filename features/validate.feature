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
