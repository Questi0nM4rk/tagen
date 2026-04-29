Feature: tagen list — display skill catalog

  Scenario: list shows all skills
    Given a skill-graph with catalog cards
    When I run "tagen list"
    Then it prints both fixture skill names

  Scenario: list --filter by language
    Given a skill-graph with catalog cards
    When I run "tagen list --filter language=dotnet"
    Then it shows dotnet and agnostic skills

  Scenario: list --json outputs valid JSON array
    Given a skill-graph with catalog cards
    When I run "tagen list --json"
    Then stdout is valid JSON
    And it contains an array of skill objects
