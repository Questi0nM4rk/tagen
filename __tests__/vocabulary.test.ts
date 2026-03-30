import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { CatalogCard, Vocabulary } from "../src/lib/types.ts";
import {
  getOrder,
  getValidValues,
  loadVocabulary,
  validateCard,
} from "../src/lib/vocabulary.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph");

// ─── loadVocabulary ───────────────────────────────────────────────────────────

describe("loadVocabulary", () => {
  test("loads vocabulary from fixture and has expected top-level dimensions", () => {
    const vocab = loadVocabulary(FIXTURES);
    expect(vocab.dimensions).toBeDefined();
    expect(vocab.dimensions.phase).toBeDefined();
    expect(vocab.dimensions.domain).toBeDefined();
    expect(vocab.dimensions.language).toBeDefined();
    expect(vocab.dimensions.layer).toBeDefined();
    expect(vocab.dimensions.concerns).toBeDefined();
  });

  test("has relationships section", () => {
    const vocab = loadVocabulary(FIXTURES);
    expect(vocab.relationships).toBeDefined();
  });
});

// ─── getValidValues ───────────────────────────────────────────────────────────

describe("getValidValues", () => {
  let vocab: Vocabulary;

  test("returns array including implementation for phase", () => {
    vocab = loadVocabulary(FIXTURES);
    const values = getValidValues(vocab, "phase");
    expect(values).toContain("implementation");
    expect(values).toContain("testing");
    expect(values).toContain("planning");
    expect(values).toContain("design");
  });

  test("returns exactly [agnostic, dotnet, typescript, python] for language", () => {
    vocab = loadVocabulary(FIXTURES);
    const values = getValidValues(vocab, "language");
    expect(values.sort()).toEqual(
      ["agnostic", "dotnet", "python", "typescript"].sort()
    );
  });

  test("returns known layer values", () => {
    vocab = loadVocabulary(FIXTURES);
    const values = getValidValues(vocab, "layer");
    expect(values).toContain("orchestrator");
    expect(values).toContain("methodology");
    expect(values).toContain("standards");
  });

  test("returns empty array for unknown dimension", () => {
    vocab = loadVocabulary(FIXTURES);
    const values = getValidValues(vocab, "nonexistent");
    expect(values).toEqual([]);
  });
});

// ─── getOrder ─────────────────────────────────────────────────────────────────

describe("getOrder", () => {
  let vocab: Vocabulary;

  test("phase order starts with planning", () => {
    vocab = loadVocabulary(FIXTURES);
    const order = getOrder(vocab, "phase");
    expect(order[0]).toBe("planning");
  });

  test("phase order ends with operations", () => {
    vocab = loadVocabulary(FIXTURES);
    const order = getOrder(vocab, "phase");
    expect(order[order.length - 1]).toBe("operations");
  });

  test("layer order starts with orchestrator", () => {
    vocab = loadVocabulary(FIXTURES);
    const order = getOrder(vocab, "layer");
    expect(order[0]).toBe("orchestrator");
  });

  test("layer order ends with utility", () => {
    vocab = loadVocabulary(FIXTURES);
    const order = getOrder(vocab, "layer");
    expect(order[order.length - 1]).toBe("utility");
  });

  test("language falls back to values keys when no order defined", () => {
    vocab = loadVocabulary(FIXTURES);
    const order = getOrder(vocab, "language");
    // language has no explicit order — falls back to Object.keys(values)
    expect(order).toContain("agnostic");
    expect(order).toContain("typescript");
  });

  test("returns empty array for unknown dimension", () => {
    vocab = loadVocabulary(FIXTURES);
    const order = getOrder(vocab, "nonexistent");
    expect(order).toEqual([]);
  });
});

// ─── validateCard ─────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<CatalogCard> = {}): CatalogCard {
  return {
    skill: "test-skill",
    plugin: "test-plugin",
    source: "plugins/test/skills/test-skill/SKILL.md",
    tags: {
      phase: ["implementation"],
      domain: ["testing"],
      language: "typescript",
      layer: "standards",
      concerns: ["testing"],
    },
    composes: [],
    enhances: [],
    description: "A test skill.",
    ironLaws: [],
    body: "# Test",
    filePath: "/tmp/test-skill.md",
    ...overrides,
  };
}

describe("validateCard", () => {
  let vocab: Vocabulary;

  test("valid card returns empty errors array", () => {
    vocab = loadVocabulary(FIXTURES);
    const card = makeCard();
    const errors = validateCard(card, vocab);
    expect(errors).toEqual([]);
  });

  test("unknown phase value returns error containing 'unknown phase value'", () => {
    vocab = loadVocabulary(FIXTURES);
    const card = makeCard({
      tags: {
        phase: ["invalid-phase"],
        domain: ["testing"],
        language: "typescript",
        layer: "standards",
        concerns: [],
      },
    });
    const errors = validateCard(card, vocab);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("unknown phase value"))).toBe(true);
    expect(errors.some((e) => e.includes("invalid-phase"))).toBe(true);
  });

  test("unknown language value returns error containing 'unknown language value'", () => {
    vocab = loadVocabulary(FIXTURES);
    const card = makeCard({
      tags: {
        phase: ["implementation"],
        domain: ["testing"],
        language: "java",
        layer: "standards",
        concerns: [],
      },
    });
    const errors = validateCard(card, vocab);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("unknown language value"))).toBe(true);
    expect(errors.some((e) => e.includes("java"))).toBe(true);
  });

  test("unknown layer value returns error", () => {
    vocab = loadVocabulary(FIXTURES);
    const card = makeCard({
      tags: {
        phase: ["implementation"],
        domain: ["testing"],
        language: "agnostic",
        layer: "invalid-layer",
        concerns: [],
      },
    });
    const errors = validateCard(card, vocab);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("unknown layer value"))).toBe(true);
  });

  test("unknown concern value returns error", () => {
    vocab = loadVocabulary(FIXTURES);
    const card = makeCard({
      tags: {
        phase: ["implementation"],
        domain: ["testing"],
        language: "agnostic",
        layer: "standards",
        concerns: ["unknown-concern"],
      },
    });
    const errors = validateCard(card, vocab);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("unknown concern"))).toBe(true);
  });

  test("unknown domain value returns error", () => {
    vocab = loadVocabulary(FIXTURES);
    const card = makeCard({
      tags: {
        phase: ["implementation"],
        domain: ["fake-domain"],
        language: "agnostic",
        layer: "standards",
        concerns: [],
      },
    });
    const errors = validateCard(card, vocab);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("unknown domain value"))).toBe(true);
  });

  test("multiple phase values — one valid, one invalid — reports only invalid", () => {
    vocab = loadVocabulary(FIXTURES);
    const card = makeCard({
      tags: {
        phase: ["implementation", "bad-phase"],
        domain: ["testing"],
        language: "agnostic",
        layer: "standards",
        concerns: [],
      },
    });
    const errors = validateCard(card, vocab);
    // Only bad-phase should appear as an errored value, not implementation
    expect(errors.some((e) => e.includes('"bad-phase"'))).toBe(true);
    expect(errors.some((e) => e.includes('"implementation"'))).toBe(false);
    // Exactly one error (for bad-phase)
    expect(errors).toHaveLength(1);
  });

  test("error message includes skill name prefix", () => {
    vocab = loadVocabulary(FIXTURES);
    const card = makeCard({
      skill: "my-skill",
      tags: {
        phase: ["bad-phase"],
        domain: ["testing"],
        language: "agnostic",
        layer: "standards",
        concerns: [],
      },
    });
    const errors = validateCard(card, vocab);
    expect(errors.some((e) => e.startsWith("[my-skill]"))).toBe(true);
  });
});
