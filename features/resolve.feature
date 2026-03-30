Feature: tagen resolve — skill path resolution

  Scenario: resolve by phase and language includes agnostic skills
    Given a skill-graph with agnostic and typescript skills
    When I run "tagen resolve --phase implementation --language typescript"
    Then the output includes tdd-workflow
    And the output includes ts-tdd

  Scenario: resolve --json outputs valid JSON
    Given a skill-graph with catalog cards
    When I run "tagen resolve --phase implementation --json"
    Then stdout is valid JSON
    And it contains a "path" array

  Scenario: resolve --expand includes composed skills
    Given ts-tdd composes tdd-workflow
    When I run "tagen resolve --language typescript --expand"
    Then the output includes tdd-workflow as an expanded skill
