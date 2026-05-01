Feature: tagen get — resolve a composition into a JSON manifest

  Scenario: positional fuzzy match yields a manifest
    Given the canonical fixture brain
    When I run tagen with args get strict csharp --json
    Then it exits 0
    And stdout is valid JSON
    And the manifest has every required field

  Scenario: alias resolves
    Given the canonical fixture brain
    When I run tagen with args get strict dotnet --json
    Then it exits 0
    And stdout is valid JSON
    And manifest.modules contains a card lang/csharp

  Scenario: bare type-name positional triggers browse intent
    Given the canonical fixture brain
    When I run tagen with args get methodology
    Then it exits 0
    And stdout contains "methodology/tdd"

  Scenario: get with no positional args exits 2 with no-cards-matched
    Given the canonical fixture brain
    When I run tagen with args get
    Then it exits 2
    And stderr contains "no cards matched"

  Scenario: ambiguous fuzzy exits 1
    Given the canonical fixture brain
    When I run tagen with args get dot --json
    Then it exits 1
    And stderr contains "ambiguous arg"

  Scenario: alphabetical-first slot fill with --pin override
    Given the canonical fixture brain
    When I run tagen with args get strict csharp python --pin lang=python --json
    Then it exits 0
    And stdout is valid JSON
    And the lang slot is filled by python
