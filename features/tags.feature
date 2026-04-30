Feature: tagen tags — print all four controlled vocabularies

  Scenario: tags prints tag dimensions
    Given a skill-graph with catalog cards
    When I run "tagen tags"
    Then it prints the phase dimension

  Scenario: tags prints capabilities and protocols and subagents
    Given a skill-graph with catalog cards
    When I run "tagen tags"
    Then it prints the capabilities section
    And it prints the protocols section
    And it prints the subagents section

  Scenario: tags --json emits one combined object
    Given a skill-graph with catalog cards
    When I run "tagen tags --json"
    Then stdout is valid JSON
    And the JSON has top-level keys tags, capabilities, protocols, subagents
