import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  expandComposes,
  filterCards,
  loadAllCards,
  sortCards,
  sourceExists,
} from "../src/lib/catalog.ts";
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
  test("loads all 3 fixture cards", () => {
    expect(allCards).toHaveLength(3);
  });

  test("parses skill names correctly", () => {
    const skills = allCards.map((c) => c.skill).sort();
    expect(skills).toEqual(["python-bdd", "tdd-workflow", "ts-tdd"]);
  });

  test("parses plugin field", () => {
    const tdd = allCards.find((c) => c.skill === "tdd-workflow");
    expect(tdd?.plugin).toBe("qsm-methodology");
  });

  test("parses description from YAML frontmatter", () => {
    const tdd = allCards.find((c) => c.skill === "tdd-workflow");
    expect(tdd?.description).toBe(
      "Use when implementing features using test-driven development."
    );
  });

  test("parses iron_laws as array", () => {
    const tdd = allCards.find((c) => c.skill === "tdd-workflow");
    expect(tdd?.ironLaws).toHaveLength(3);
    expect(tdd?.ironLaws[0]).toContain("Test before code");
  });

  test("parses composes relationship", () => {
    const tsTdd = allCards.find((c) => c.skill === "ts-tdd");
    expect(tsTdd?.composes).toEqual(["tdd-workflow"]);
  });

  test("parses enhances relationship", () => {
    const tdd = allCards.find((c) => c.skill === "tdd-workflow");
    expect(tdd?.enhances).toEqual(["bdd-workflow"]);
  });

  test("returns empty array for non-existent vault dir", () => {
    const result = loadAllCards("/nonexistent/path");
    expect(result).toEqual([]);
  });
});

// ─── filterCards ─────────────────────────────────────────────────────────────

describe("filterCards", () => {
  test("language=typescript matches ts-tdd AND tdd-workflow (agnostic)", () => {
    const result = filterCards(allCards, { language: ["typescript"] });
    const skills = result.map((c) => c.skill).sort();
    expect(skills).toContain("ts-tdd");
    expect(skills).toContain("tdd-workflow"); // agnostic included
    expect(skills).not.toContain("python-bdd");
  });

  test("language=python matches python-bdd AND tdd-workflow (agnostic)", () => {
    const result = filterCards(allCards, { language: ["python"] });
    const skills = result.map((c) => c.skill).sort();
    expect(skills).toContain("python-bdd");
    expect(skills).toContain("tdd-workflow"); // agnostic included
    expect(skills).not.toContain("ts-tdd");
  });

  test("domain=testing returns all 3 cards", () => {
    const result = filterCards(allCards, { domain: ["testing"] });
    expect(result).toHaveLength(3);
  });

  test("phase=implementation returns tdd-workflow and ts-tdd", () => {
    const result = filterCards(allCards, { phase: ["implementation"] });
    const skills = result.map((c) => c.skill).sort();
    expect(skills).toContain("tdd-workflow");
    expect(skills).toContain("ts-tdd");
    expect(skills).not.toContain("python-bdd");
  });

  test("phase=specification returns python-bdd only", () => {
    const result = filterCards(allCards, { phase: ["specification"] });
    const skills = result.map((c) => c.skill);
    expect(skills).toContain("python-bdd");
    expect(skills).not.toContain("ts-tdd");
  });

  test("AND across dimensions — language=typescript AND phase=testing", () => {
    // ts-tdd has both implementation and testing phases, typescript language
    const result = filterCards(allCards, {
      language: ["typescript"],
      phase: ["testing"],
    });
    const skills = result.map((c) => c.skill);
    expect(skills).toContain("ts-tdd");
    // tdd-workflow has testing phase and is agnostic — passes both
    expect(skills).toContain("tdd-workflow");
  });

  test("OR within dimension — phase=specification OR phase=implementation", () => {
    const result = filterCards(allCards, {
      phase: ["specification", "implementation"],
    });
    // All 3 cards have at least one of these phases
    expect(result).toHaveLength(3);
  });

  test("empty filter returns all cards", () => {
    const result = filterCards(allCards, {});
    expect(result).toHaveLength(3);
  });

  test("no match returns empty array", () => {
    const result = filterCards(allCards, { domain: ["api"] });
    expect(result).toHaveLength(0);
  });
});

// ─── sortCards ────────────────────────────────────────────────────────────────

describe("sortCards", () => {
  test("sorts by earliest phase order", () => {
    const sorted = sortCards(allCards, vocab);
    // specification comes before implementation in phase order
    // python-bdd has [specification, testing], tdd-workflow has [implementation, testing]
    const pyIdx = sorted.findIndex((c) => c.skill === "python-bdd");
    const tddIdx = sorted.findIndex((c) => c.skill === "tdd-workflow");
    // specification (index 2) < implementation (index 3) in phase order
    expect(pyIdx).toBeLessThan(tddIdx);
  });

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

// ─── expandComposes ───────────────────────────────────────────────────────────

describe("expandComposes", () => {
  test("adds tdd-workflow when ts-tdd is in path", () => {
    const tsTdd = allCards.find((c) => c.skill === "ts-tdd");
    if (!tsTdd) throw new Error("ts-tdd fixture missing");
    const result = expandComposes([tsTdd], allCards);
    const skills = result.map((c) => c.skill);
    expect(skills).toContain("tdd-workflow");
    expect(skills).toContain("ts-tdd");
  });

  test("does not add duplicate if composed skill already in path", () => {
    const tsTdd = allCards.find((c) => c.skill === "ts-tdd");
    const tddWorkflow = allCards.find((c) => c.skill === "tdd-workflow");
    if (!tsTdd || !tddWorkflow) throw new Error("fixture cards missing");
    const result = expandComposes([tsTdd, tddWorkflow], allCards);
    const tddCount = result.filter((c) => c.skill === "tdd-workflow").length;
    expect(tddCount).toBe(1);
  });

  test("returns original path unchanged when no composes relationships", () => {
    const pyBdd = allCards.find((c) => c.skill === "python-bdd");
    if (!pyBdd) throw new Error("python-bdd fixture missing");
    const result = expandComposes([pyBdd], allCards);
    expect(result).toHaveLength(1);
    expect(result[0].skill).toBe("python-bdd");
  });

  test("returns path + expanded in order (original first)", () => {
    const tsTdd = allCards.find((c) => c.skill === "ts-tdd");
    if (!tsTdd) throw new Error("ts-tdd fixture missing");
    const result = expandComposes([tsTdd], allCards);
    expect(result[0].skill).toBe("ts-tdd");
    expect(result[1].skill).toBe("tdd-workflow");
  });

  test("ignores composed skills not found in allCards", () => {
    const card: CatalogCard = {
      skill: "orphan",
      plugin: "test",
      source: "nowhere",
      tags: {
        phase: [],
        domain: [],
        language: "agnostic",
        layer: "reference",
        concerns: [],
      },
      composes: ["nonexistent-skill"],
      enhances: [],
      description: "",
      ironLaws: [],
      body: "",
      filePath: "",
    };
    const result = expandComposes([card], allCards);
    expect(result).toHaveLength(1);
  });
});

// ─── sourceExists ─────────────────────────────────────────────────────────────

describe("sourceExists", () => {
  test("returns false when source path does not exist", () => {
    const card = allCards.find((c) => c.skill === "tdd-workflow");
    if (!card) throw new Error("tdd-workflow fixture missing");
    // source is plugins/qsm-methodology/... — doesn't exist in fixtures
    const result = sourceExists(card, FIXTURES);
    expect(result).toBe(false);
  });

  test("returns true when source path exists", () => {
    // Construct a card whose source resolves to a real file
    const realPath = join(FIXTURES, "skills/tdd-workflow.md");
    const card: CatalogCard = {
      skill: "tdd-workflow",
      plugin: "qsm-methodology",
      source: "skills/tdd-workflow.md",
      tags: {
        phase: [],
        domain: [],
        language: "agnostic",
        layer: "reference",
        concerns: [],
      },
      composes: [],
      enhances: [],
      description: "",
      ironLaws: [],
      body: "",
      filePath: realPath,
    };
    const result = sourceExists(card, FIXTURES);
    expect(result).toBe(true);
  });
});
