import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadAllCards, marketplaceRoot } from "../src/lib/catalog.ts";
import {
  type ComposeQuery,
  compose,
  emptyQuery,
  knownTypesFromCards,
} from "../src/lib/compose.ts";

const BRAIN = join(import.meta.dir, "fixtures", "brain");
const ROOT = marketplaceRoot(BRAIN);
const { cards } = loadAllCards(BRAIN);
const knownTypes = knownTypesFromCards(cards);

function q(
  positional: string[] = [],
  overrides: Partial<ComposeQuery> = {}
): ComposeQuery {
  return { ...emptyQuery(), positional, ...overrides };
}

describe("compose", () => {
  test("positional fuzzy match resolves to a card", () => {
    const r = compose(cards, ROOT, q(["csharp"]), knownTypes);
    expect(r.errors).toEqual([]);
    expect(r.manifest?.modules.map((m) => m.name)).toEqual(["csharp"]);
  });

  test("alias resolves", () => {
    const r = compose(cards, ROOT, q(["dotnet"]), knownTypes);
    expect(r.manifest?.modules[0]?.name).toBe("csharp");
  });

  test("ambiguous fuzzy returns error", () => {
    const r = compose(cards, ROOT, q(["dot"]), knownTypes); // matches lang/csharp(alias) + framework/dotnet10
    expect(r.errors[0]).toContain("ambiguous arg");
    expect(r.manifest).toBeUndefined();
  });

  test("3-char minimum enforced", () => {
    const r = compose(cards, ROOT, q(["py"]), knownTypes);
    expect(r.errors[0]).toContain("shorter than minimum");
  });

  test("bare type name triggers browse intent", () => {
    const r = compose(cards, ROOT, q(["methodology"]), knownTypes);
    expect(r.browseTypes).toEqual(["methodology"]);
    expect(r.manifest).toBeUndefined();
  });

  test("review + lang fills the lang slot", () => {
    const r = compose(cards, ROOT, q(["strict", "csharp"]), knownTypes);
    expect(r.manifest?.slots).toEqual([
      { type: "lang", fillerCard: "csharp", candidates: ["csharp"] },
    ]);
    expect(r.manifest?.filled.lang?.core).toBe("brain/lang/csharp/CORE.md");
  });

  test("multiple lang candidates → alphabetical first wins, warning emitted", () => {
    const r = compose(cards, ROOT, q(["strict", "csharp", "python"]), knownTypes);
    expect(r.manifest?.slots[0]?.fillerCard).toBe("csharp");
    expect(r.manifest?.slots[0]?.candidates).toEqual(["csharp", "python"]);
    expect(r.manifest?.warnings.some((w) => w.includes("multiple candidates"))).toBe(
      true
    );
  });

  test("--pin overrides alphabetical", () => {
    const pins = new Map([["lang", "python"]]);
    const r = compose(
      cards,
      ROOT,
      q(["strict", "csharp", "python"], { pins }),
      knownTypes
    );
    expect(r.manifest?.slots[0]?.fillerCard).toBe("python");
  });

  test("unfilled slot warns instead of erroring", () => {
    const r = compose(cards, ROOT, q(["strict"]), knownTypes); // no lang in matched set
    expect(r.manifest?.warnings.some((w) => w.includes("unfilled slot"))).toBe(true);
    expect(r.manifest?.slots[0]?.fillerCard).toBe("");
  });

  test("subagents collected from review/methodology", () => {
    const r = compose(cards, ROOT, q(["strict", "csharp"]), knownTypes);
    expect(r.manifest?.subagents).toEqual([
      "brain/subagent/security-reviewer/CORE.md",
      "brain/subagent/style-reviewer/CORE.md",
    ]);
  });

  test("validators collected from review cards only", () => {
    const r = compose(cards, ROOT, q(["strict", "csharp"]), knownTypes);
    expect(r.manifest?.validators).toEqual([
      "brain/review/strict/validators/no-emoji.ts",
    ]);
  });

  test("filler card excluded from core[] / references[]", () => {
    const r = compose(cards, ROOT, q(["strict", "csharp"]), knownTypes);
    expect(r.manifest?.core).toEqual(["brain/review/strict/CORE.md"]);
    expect(r.manifest?.references).toEqual([
      "brain/review/strict/references/workflow.md",
    ]);
  });

  test("empty match set is reported separately from errors", () => {
    const r = compose(cards, ROOT, q([]), knownTypes);
    expect(r.emptyMatch).toBe(true);
    expect(r.manifest).toBeUndefined();
  });

  test("explicit --type/--name selection bypasses fuzzy", () => {
    const r = compose(
      cards,
      ROOT,
      q([], { explicit: [{ type: "lang", name: "rust" }] }),
      knownTypes
    );
    expect(r.manifest?.modules.map((m) => m.name)).toEqual(["rust"]);
  });

  test("manifest paths are root-relative", () => {
    const r = compose(cards, ROOT, q(["strict", "csharp"]), knownTypes);
    expect(r.manifest?.root).toBe(ROOT);
    for (const path of r.manifest?.core ?? []) {
      expect(path.startsWith("/")).toBe(false);
      expect(path.startsWith("brain/")).toBe(true);
    }
  });
});
