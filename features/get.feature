Feature: tagen get — resolve composition into a JSON manifest

  Scenario: --json flag emits manifest with all 9 top-level keys
    Given a skill-graph with v2 cards that satisfy all requires
    When I run "tagen get --language dotnet --json"
    Then it exits 0
    And stdout is valid JSON
    And the manifest contains keys modules, core, subagents, refs, validators, emits, consumes, warnings, slots

  Scenario: unmet requires yields warning in manifest.warnings but exits 0
    Given a skill-graph with a card whose requires are not satisfied
    When I run "tagen get --domain code-review --json"
    Then it exits 0
    And stdout is valid JSON
    And manifest.warnings is non-empty

  Scenario: empty match set exits 2
    Given a skill-graph with catalog cards
    When I run "tagen get --domain data-processing --json"
    Then it exits 2
    And it prints "No cards matched" to stderr

  Scenario: non-JSON mode prints compact summary
    Given a skill-graph with v2 cards that satisfy all requires
    When I run "tagen get --language dotnet"
    Then it exits 0
    And it prints a compact summary line with card count and slot count

  Scenario: --card override restricts matched set to named cards and resolves slots
    Given a skill-graph with v2 cards that satisfy all requires
    When I run "tagen get --card v2-strict-review --card v2-csharp-patterns --json"
    Then it exits 0
    And stdout is valid JSON
    And manifest.modules contains only the named cards
    And manifest.slots is non-empty
