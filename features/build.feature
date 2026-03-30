Feature: tagen build — plugin assembly from catalog cards

  Scenario: build a plugin with language query
    Given a skill-graph with typescript skills
    When I run "tagen build --plugin qsm-typescript-lang"
    Then it writes SKILL.md for ts-tdd
    And it writes the references markdown for ts-tdd with the skill body
    And it writes plugin.json with the correct plugin name
    And it writes .build-hash

  Scenario: build skips unchanged plugins
    Given a plugin with matching .build-hash
    When I run "tagen build --plugin qsm-typescript-lang"
    Then it prints "up to date" for qsm-typescript-lang
    And it does not overwrite any files

  Scenario: build --all builds every plugin with a build.yaml
    Given a skill-graph with multiple plugins
    When I run "tagen build --all"
    Then it builds all plugins

  Scenario: include overrides query exclusion
    Given a build.yaml with no queries and include: [tdd-workflow]
    When I run "tagen build --plugin qsm-custom"
    Then it includes tdd-workflow in the output
