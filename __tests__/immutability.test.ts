import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { CommandResult } from "../src/cli/result.ts";
import { compose, emptyQuery, knownTypesFromCards } from "../src/composition/index.ts";
import { loadAgnosticConfig } from "../src/lib/agnostic-config.ts";
import { loadAllCards, marketplaceRoot } from "../src/lib/catalog.ts";
import { fuzzyMatch } from "../src/lib/fuzzy.ts";
import { ImmutableMap, ImmutableSet } from "../src/lib/immutable-collections.ts";

const BRAIN = join(import.meta.dir, "fixtures", "brain");
const ROOT = marketplaceRoot(BRAIN);

describe("immutable public contracts", () => {
  test("immutable map and set expose no mutation methods", () => {
    const map = new ImmutableMap([["key", "value"]]);
    const set = new ImmutableSet(["value"]);

    expect(map.get("key")).toBe("value");
    expect(set.has("value")).toBe(true);
    expect("set" in map).toBe(false);
    expect("add" in set).toBe(false);
    expect(Object.isFrozen(map)).toBe(true);
    expect(Object.isFrozen(set)).toBe(true);
  });

  test("immutable map preserves the readonly map contract", () => {
    const map = new ImmutableMap([
      ["first", 1],
      ["second", 2],
    ]);
    const visited: string[] = [];

    map.forEach((value, key, owner) => {
      visited.push(`${key}:${value}:${owner.size}`);
    });

    expect(map.size).toBe(2);
    expect(map.has("first")).toBe(true);
    expect([...map]).toEqual([
      ["first", 1],
      ["second", 2],
    ]);
    expect([...map.keys()]).toEqual(["first", "second"]);
    expect([...map.values()]).toEqual([1, 2]);
    expect([...map.entries()]).toEqual([...map]);
    expect(visited).toEqual(["first:1:2", "second:2:2"]);
    expect(map[Symbol.toStringTag]).toBe("ImmutableMap");
  });

  test("immutable set preserves the readonly set contract", () => {
    const set = new ImmutableSet(["a", "b"]);
    const other = new Set(["b", "c"]);
    const visited: string[] = [];

    set.forEach((value, duplicate, owner) => {
      visited.push(`${value}:${duplicate}:${owner.size}`);
    });

    expect(set.size).toBe(2);
    expect([...set]).toEqual(["a", "b"]);
    expect([...set.keys()]).toEqual(["a", "b"]);
    expect([...set.values()]).toEqual(["a", "b"]);
    expect([...set.entries()]).toEqual([
      ["a", "a"],
      ["b", "b"],
    ]);
    expect(set.union(other)).toEqual(new Set(["a", "b", "c"]));
    expect(set.intersection(other)).toEqual(new Set(["b"]));
    expect(set.difference(other)).toEqual(new Set(["a"]));
    expect(set.symmetricDifference(other)).toEqual(new Set(["a", "c"]));
    expect(set.isSubsetOf(new Set(["a", "b", "c"]))).toBe(true);
    expect(set.isSupersetOf(new Set(["a"]))).toBe(true);
    expect(set.isDisjointFrom(new Set(["c"]))).toBe(true);
    expect(visited).toEqual(["a:a:2", "b:b:2"]);
    expect(set[Symbol.toStringTag]).toBe("ImmutableSet");
  });

  test("command results are frozen and reject invalid exit codes", () => {
    const failure = CommandResult.failure(2);

    expect(Object.isFrozen(CommandResult.SUCCESS)).toBe(true);
    expect(Object.isFrozen(failure)).toBe(true);
    expect(failure.exitCode).toBe(2);
    expect(() => CommandResult.failure(0)).toThrow("invalid CLI exit code");
    expect(() => CommandResult.failure(256)).toThrow("invalid CLI exit code");
  });

  test("catalog objects and collections are frozen", () => {
    const result = loadAllCards(BRAIN);
    const first = result.cards[0];
    if (!first) throw new Error("fixture catalog is empty");

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.cards)).toBe(true);
    expect(Object.isFrozen(result.protocols)).toBe(true);
    expect(Object.isFrozen(result.catalogErrors)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.id)).toBe(true);
    expect(Object.isFrozen(first.frontmatter)).toBe(true);
    expect(Object.isFrozen(first.references)).toBe(true);
    expect(Object.isFrozen(first.validators)).toBe(true);
  });

  test("configuration and fuzzy-match results are frozen", () => {
    const config = loadAgnosticConfig(ROOT, []);
    const matches = fuzzyMatch(
      [
        {
          id: Object.freeze({ type: "lang", name: "typescript" }),
          haystacks: Object.freeze(["typescript"]),
        },
      ],
      "typescript"
    );

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.config)).toBe(true);
    expect(Object.isFrozen(config.config.additionalTerms)).toBe(true);
    expect(Object.isFrozen(config.config.allow)).toBe(true);
    expect(Object.isFrozen(config.errors)).toBe(true);
    expect(Object.isFrozen(matches)).toBe(true);
    expect(Object.isFrozen(matches[0])).toBe(true);
  });

  test("composition outcomes and manifests are frozen", () => {
    const { cards } = loadAllCards(BRAIN);
    const query = {
      ...emptyQuery(),
      positional: Object.freeze(["strict", "csharp"]),
    };
    const result = compose(cards, ROOT, query, knownTypesFromCards(cards));
    if (!result.manifest) throw new Error("fixture composition produced no manifest");

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.errors)).toBe(true);
    expect(Object.isFrozen(result.browseTypes)).toBe(true);
    expect(Object.isFrozen(result.manifest)).toBe(true);
    expect(Object.isFrozen(result.manifest.modules)).toBe(true);
    expect(Object.isFrozen(result.manifest.filled)).toBe(true);
    expect(Object.isFrozen(result.manifest.slots)).toBe(true);
    expect(Object.isFrozen(result.manifest.warnings)).toBe(true);
  });
});
