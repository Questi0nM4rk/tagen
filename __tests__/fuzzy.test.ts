import { describe, expect, test } from "bun:test";
import { type FuzzyEntry, fuzzyMatch, MIN_QUERY_LENGTH } from "../src/lib/fuzzy.ts";

const entries: FuzzyEntry[] = [
  { id: { type: "lang", name: "csharp" }, haystacks: ["csharp", "dotnet"] },
  { id: { type: "lang", name: "python" }, haystacks: ["python"] },
  { id: { type: "framework", name: "dotnet10" }, haystacks: ["dotnet10"] },
  { id: { type: "review", name: "strict" }, haystacks: ["strict"] },
];

describe("fuzzyMatch", () => {
  test("returns empty when query shorter than minimum", () => {
    expect(fuzzyMatch(entries, "py")).toEqual([]);
    expect(MIN_QUERY_LENGTH).toBe(3);
  });

  test("exact match wins", () => {
    const r = fuzzyMatch(entries, "csharp");
    expect(r).toHaveLength(1);
    expect(r[0]?.id).toEqual({ type: "lang", name: "csharp" });
  });

  test("alias match", () => {
    const r = fuzzyMatch(entries, "dotnet");
    expect(r).toHaveLength(1);
    expect(r[0]?.id).toEqual({ type: "lang", name: "csharp" });
    expect(r[0]?.matchedOn).toBe("dotnet");
  });

  test("prefix beats substring", () => {
    const e: FuzzyEntry[] = [
      { id: { type: "a", name: "abc" }, haystacks: ["abc"] }, // substring of 'xabc'
      { id: { type: "b", name: "abcdef" }, haystacks: ["abcdef"] }, // prefix of 'abc'
    ];
    const r = fuzzyMatch(e, "abc");
    expect(r.map((c) => c.id.name).sort()).toEqual(["abc"]);
  });

  test("substring matches multiple — caller resolves ambiguity", () => {
    const r = fuzzyMatch(entries, "net");
    const names = r.map((c) => `${c.id.type}/${c.id.name}`).sort();
    expect(names).toEqual(["framework/dotnet10", "lang/csharp"]);
  });

  test("Levenshtein fallback for typos within distance 2", () => {
    const r = fuzzyMatch(entries, "csharrp");
    expect(r).toHaveLength(1);
    expect(r[0]?.id.name).toBe("csharp");
  });

  test("no match → empty", () => {
    expect(fuzzyMatch(entries, "xyzzyzzz")).toEqual([]);
  });
});
