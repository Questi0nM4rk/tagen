import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findBrainDir,
  loadAllCards,
  marketplaceRoot,
  resolveBrainDir,
} from "../src/lib/catalog.ts";

const FIXTURES = join(import.meta.dir, "fixtures");
const BRAIN = join(FIXTURES, "brain");

describe("findBrainDir", () => {
  test("finds brain/ in the given dir", () => {
    expect(findBrainDir(FIXTURES)).toBe(BRAIN);
  });

  test("walks up to find brain/", () => {
    expect(findBrainDir(join(BRAIN, "lang", "csharp"))).toBe(BRAIN);
  });

  test("throws when no brain/ above", () => {
    const empty = mkdtempSync(join(tmpdir(), "tagen-no-brain-"));
    try {
      expect(() => findBrainDir(empty)).toThrow(/no brain\/ directory found/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("resolveBrainDir", () => {
  test("resolves <root>/brain exactly", () => {
    expect(resolveBrainDir(FIXTURES)).toBe(BRAIN);
  });

  test("does not walk up from the explicit root", () => {
    expect(() => resolveBrainDir(join(BRAIN, "lang", "csharp"))).toThrow(
      /no brain\/ directory at/
    );
  });

  test("reports the resolved root when brain is absent", () => {
    const empty = mkdtempSync(join(tmpdir(), "tagen-root-no-brain-"));
    try {
      expect(() => resolveBrainDir(empty)).toThrow(empty);
      expect(() => resolveBrainDir(empty)).toThrow(/--root/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("marketplaceRoot", () => {
  test("returns the parent of brain/", () => {
    expect(marketplaceRoot(BRAIN)).toBe(FIXTURES);
  });
});

describe("loadAllCards", () => {
  const result = loadAllCards(BRAIN);

  test("walks every type dir", () => {
    const types = new Set(result.cards.map((c) => c.id.type));
    expect(types).toEqual(
      new Set([
        "architecture",
        "framework",
        "lang",
        "methodology",
        "protocol",
        "review",
        "subagent",
        "test",
      ])
    );
  });

  test("loads csharp with dotnet alias", () => {
    const csharp = result.cards.find(
      (c) => c.id.type === "lang" && c.id.name === "csharp"
    );
    expect(csharp?.frontmatter.aliases).toEqual(["dotnet"]);
  });

  test("review/strict has subagents + validators + references", () => {
    const strict = result.cards.find(
      (c) => c.id.type === "review" && c.id.name === "strict"
    );
    expect(strict?.frontmatter.subagents).toEqual([
      "security-reviewer",
      "style-reviewer",
    ]);
    expect(strict?.frontmatter.requires).toEqual(["lang"]);
    expect(strict?.references).toEqual(["brain/review/strict/references/workflow.md"]);
    expect(strict?.validators).toEqual(["brain/review/strict/validators/no-emoji.ts"]);
  });

  test("subagents carry harness-neutral uses frontmatter", () => {
    const implementer = result.cards.find(
      (c) => c.id.type === "subagent" && c.id.name === "implementer"
    );
    expect(implementer?.frontmatter.uses).toEqual(["methodology/tdd"]);
  });

  test("protocol cards include schema/validator/examples paths", () => {
    expect(result.protocols).toHaveLength(1);
    const finding = result.protocols[0];
    expect(finding?.id.name).toBe("finding");
    expect(finding?.schemaPath).toBe("brain/protocol/finding/schema.json");
    expect(finding?.validatorPath).toBe("brain/protocol/finding/validator.ts");
    expect(finding?.validExamples).toEqual([
      "brain/protocol/finding/examples/valid/sample.json",
    ]);
    expect(finding?.invalidExamples).toEqual([
      "brain/protocol/finding/examples/invalid/missing-message.json",
    ]);
  });

  test("frontmatter parse errors collected, not thrown", () => {
    expect(result.frontmatterErrors.size).toBe(0);
  });

  test("cards are sorted alphabetically by type then name", () => {
    const keys = result.cards.map((c) => `${c.id.type}/${c.id.name}`);
    expect(keys).toEqual([...keys].sort());
  });
});
