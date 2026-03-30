Feature: tagen list — display skill catalog

  Scenario: list shows all skills
    Given a skill-graph with 3 skills
    When I run "tagen list"
    Then it prints all 3 skill names

  Scenario: list --filter by language
    Given skills in typescript and python
    When I run "tagen list --filter language=typescript"
    Then it shows only typescript skills

  Scenario: list --json outputs valid JSON array
    Given a skill-graph with catalog cards
    When I run "tagen list --json"
    Then stdout is valid JSON
    And it contains an array of skill objects
