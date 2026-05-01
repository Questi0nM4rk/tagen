Feature: tagen validate — every rule, every violation, never fast-fails

  Scenario: clean canonical fixture passes
    Given the canonical fixture brain
    When I run tagen with args validate
    Then it exits 0
    And stderr is empty

  Scenario: --verbose prints scanned-count line
    Given the canonical fixture brain
    When I run tagen with args validate --verbose
    Then it exits 0
    And stderr contains "scanned"
    And stderr contains "violation(s)"
