Feature: tagen list — display skill catalog

  Scenario: list shows all skills
    Given a skill-graph with catalog cards
    When I run "tagen list"
    Then it prints both fixture skill names

  Scenario: list filters by --language (inclusive of agnostic)
    Given a skill-graph with catalog cards
    When I run "tagen list --language dotnet"
    Then it shows dotnet and agnostic skills

  Scenario: list filters by --domain (repeatable)
    Given a skill-graph with catalog cards
    When I run "tagen list --domain code-review"
    Then it prints both fixture skill names

  Scenario: list --subagents lists subagents instead of cards
    Given a skill-graph with catalog cards
    When I run "tagen list --subagents"
    Then it prints the domain-reviewer subagent

  Scenario: list --json outputs valid JSON array
    Given a skill-graph with catalog cards
    When I run "tagen list --json"
    Then stdout is valid JSON
    And it contains an array of skill objects

  Scenario: list text output includes provides, requires, and tier counts
    Given a skill-graph with catalog cards
    When I run "tagen list --domain code-review"
    Then it prints provides, requires, and tier counts per card
