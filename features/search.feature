Feature: tagen search — full-text fuzzy search across card content

  Scenario: typo'd query still finds the card
    Given the canonical fixture brain
    When I run tagen with args search asynch
    Then it exits 0
    And stdout contains "lang/csharp"
    And stdout contains "references/async.md"

  Scenario: cards matching more distinct tokens rank first
    Given the canonical fixture brain
    When I run tagen with args search review async
    Then it exits 0
    And the first stdout line contains "lang/csharp"
    And the first stdout line contains "2/2 tokens"

  Scenario: --json emits ranked structured results
    Given the canonical fixture brain
    When I run tagen with args search review async --json
    Then it exits 0
    And stdout is valid JSON
    And the first JSON search result is lang/csharp with every result field

  Scenario: --type restricts the search to one card type
    Given the canonical fixture brain
    When I run tagen with args search review --type subagent
    Then it exits 0
    And stdout contains "subagent/security-reviewer"

  Scenario: zero results exit 1 with a friendly message
    Given the canonical fixture brain
    When I run tagen with args search zzzznonsense
    Then it exits 1
    And stderr contains "no cards match"

  Scenario: search without query terms is rejected
    Given the canonical fixture brain
    When I run tagen with args search
    Then it exits 1
    And stderr contains "at least one query term"
