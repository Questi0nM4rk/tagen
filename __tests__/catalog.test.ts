import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { filterCards, loadAllCards, sortCards } from "../src/lib/catalog.ts";
import type { CatalogCard, Vocabulary } from "../src/lib/types.ts";
import { loadVocabulary } from "../src/lib/vocabulary.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph");

let allCards: CatalogCard[];
let vocab: Vocabulary;

beforeAll(() => {
  allCards = loadAllCards(FIXTURES);
  vocab = loadVocabulary(FIXTURES);
});

// ─── loadAllCards ─────────────────────────────────────────────────────────────

describe("loadAllCards", () => {
  test("loads all fixture cards", () => {
    expect(allCards.length).toBeGreaterThan(0);
  });

  test("parses skill names correctly", () => {
    const skills = allCards.map((c) => c.skill).sort();
    expect(skills).toEqual(["csharp-patterns", "strict-review"]);
  });

  test("parses description from YAML frontmatter", () => {
    const sr = allCards.find((c) => c.skill === "strict-review");
    expect(sr?.description).toContain("Zero-tolerance PR/MR review");
  });

  test("parses provides as array", () => {
    const sr = allCards.find((c) => c.skill === "strict-review");
    expect(sr?.provides).toEqual(["review-methodology"]);
  });

  test("parses requires as array", () => {
    const sr = allCards.find((c) => c.skill === "strict-review");
    expect(sr?.requires).toEqual(["language-patterns"]);
  });

  test("parses deep.slots into object", () => {
    const sr = allCards.find((c) => c.skill === "strict-review");
    expect(sr?.deep.slots).toEqual({ "language-patterns": true });
  });

  test("returns empty array for non-existent vault dir", () => {
    const result = loadAllCards("/nonexistent/path");
    expect(result).toEqual([]);
  });
});

// ─── filterCards ─────────────────────────────────────────────────────────────

describe("filterCards", () => {
  test("language=dotnet matches csharp-patterns AND strict-review (agnostic)", () => {
    const result = filterCards(allCards, { language: ["dotnet"] });
    const skills = result.map((c) => c.skill).sort();
    expect(skills).toEqual(["csharp-patterns", "strict-review"]);
  });

  test("language=python excludes dotnet-only cards but keeps agnostic", () => {
    const result = filterCards(allCards, { language: ["python"] });
    const skills = result.map((c) => c.skill);
    expect(skills).toContain("strict-review"); // agnostic
    expect(skills).not.toContain("csharp-patterns");
  });

  test("domain=code-review returns both fixture cards", () => {
    const result = filterCards(allCards, { domain: ["code-review"] });
    expect(result).toHaveLength(2);
  });

  test("phase=review returns both fixture cards", () => {
    const result = filterCards(allCards, { phase: ["review"] });
    expect(result).toHaveLength(2);
  });

  test("AND across dimensions — language=dotnet AND layer=reference", () => {
    const result = filterCards(allCards, {
      language: ["dotnet"],
      layer: ["reference"],
    });
    const skills = result.map((c) => c.skill);
    expect(skills).toEqual(["csharp-patterns"]);
  });

  test("empty filter returns all cards", () => {
    const result = filterCards(allCards, {});
    expect(result).toHaveLength(allCards.length);
  });

  test("no match returns empty array", () => {
    const result = filterCards(allCards, { domain: ["api"] });
    expect(result).toHaveLength(0);
  });
});

// ─── sortCards ────────────────────────────────────────────────────────────────

describe("sortCards", () => {
  test("returns same count as input", () => {
    const sorted = sortCards(allCards, vocab);
    expect(sorted).toHaveLength(allCards.length);
  });

  test("does not mutate original array", () => {
    const original = [...allCards];
    sortCards(allCards, vocab);
    expect(allCards.map((c) => c.skill)).toEqual(original.map((c) => c.skill));
  });
});

// ─── legacyFields detection (set by parseCard) ────────────────────────────────

describe("legacyFields", () => {
  test("clean v2 card has empty legacyFields", () => {
    const sr = allCards.find((c) => c.skill === "strict-review");
    expect(sr?.legacyFields).toEqual([]);
  });
});
