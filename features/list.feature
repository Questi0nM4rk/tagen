Feature: tagen list — browse the catalog

  Scenario: lists every card as <type>/<name>
    Given the canonical fixture brain
    When I run tagen with args list
    Then it exits 0
    And stdout contains "lang/csharp"
    And stdout contains "review/strict"
    And stdout contains "subagent/security-reviewer"

  Scenario: --type restricts to one type dir
    Given the canonical fixture brain
    When I run tagen with args list --type lang
    Then it exits 0
    And stdout contains exactly the lines lang/csharp,lang/python,lang/rust

  Scenario: --aliases adds parenthesised alias list
    Given the canonical fixture brain
    When I run tagen with args list --aliases
    Then it exits 0
    And stdout contains "lang/csharp  (dotnet)"

  Scenario: --json outputs structured entries
    Given the canonical fixture brain
    When I run tagen with args list --json
    Then it exits 0
    And stdout is valid JSON
    And the JSON array contains an entry with type lang and name csharp
