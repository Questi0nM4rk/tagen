Feature: tagen demo — preview composition matches, slots, and warnings

  Scenario: matched cards and slot fills printed when all requires are satisfied
    Given a skill-graph with v2 cards that satisfy all requires
    When I run "tagen demo --language dotnet"
    Then it exits 0
    And it prints matched card names
    And it prints slot fills

  Scenario: unfilled slot emits warning, exits 0
    Given a skill-graph with a card whose requires are not satisfied
    When I run "tagen demo --domain code-review"
    Then it exits 0
    And it prints a warning containing "unfilled slot"

  Scenario: multiple providers for one capability emits warning naming both candidates
    Given a skill-graph with two cards providing the same capability
    When I run "tagen demo --domain code-review"
    Then it exits 0
    And it prints a warning naming both provider candidates

  Scenario: empty match set exits 2
    Given a skill-graph with catalog cards
    When I run "tagen demo --domain data-processing"
    Then it exits 2
    And it prints "No cards matched" to stderr

  Scenario: unknown vocabulary value exits 1
    Given a skill-graph with catalog cards
    When I run "tagen demo --language cobol"
    Then it exits 1
    And it prints "unknown language value" to stderr

  Scenario: --verbose prints resolution trace
    Given a skill-graph with catalog cards
    When I run "tagen demo --domain code-review --verbose"
    Then it exits 0
    And it prints a resolution trace
