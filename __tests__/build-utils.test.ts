import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bumpVersion,
  computeContentHash,
  loadBuildConfig,
  readBuildHash,
  resolveSkills,
  strictFilterCards,
  writeBuildHash,
} from "../src/lib/build-utils.ts";
import { loadAllCards } from "../src/lib/catalog.ts";
import type { CatalogCard } from "../src/lib/types.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph");
const PLUGIN_FIXTURES = join(import.meta.dir, "fixtures/plugins");

let allCards: CatalogCard[];
let tmpDir: string;

beforeAll(() => {
  allCards = loadAllCards(FIXTURES);
  tmpDir = mkdtempSync(join(tmpdir(), "tagen-test-"));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── loadBuildConfig ──────────────────────────────────────────────────────────

describe("loadBuildConfig", () => {
  test("loads qsm-methodology build.yaml with correct name", () => {
    const config = loadBuildConfig(join(PLUGIN_FIXTURES, "qsm-methodology"));
    expect(config.name).toBe("qsm-methodology");
  });

  test("loads qsm-methodology build.yaml with correct version", () => {
    const config = loadBuildConfig(join(PLUGIN_FIXTURES, "qsm-methodology"));
    expect(config.version).toBe("1.0.0");
  });

  test("loads qsm-methodology build.yaml with keywords", () => {
    const config = loadBuildConfig(join(PLUGIN_FIXTURES, "qsm-methodology"));
    expect(config.keywords).toContain("tdd");
    expect(config.keywords).toContain("bdd");
  });

  test("loads queries array", () => {
    const config = loadBuildConfig(join(PLUGIN_FIXTURES, "qsm-methodology"));
    expect(config.queries).toHaveLength(1);
    expect(config.queries[0].tags).toBeDefined();
  });

  test("loads empty include and exclude arrays", () => {
    const config = loadBuildConfig(join(PLUGIN_FIXTURES, "qsm-methodology"));
    expect(config.include).toEqual([]);
    expect(config.exclude).toEqual([]);
  });

  test("loads qsm-typescript-lang correctly", () => {
    const config = loadBuildConfig(join(PLUGIN_FIXTURES, "qsm-typescript-lang"));
    expect(config.name).toBe("qsm-typescript-lang");
    expect(config.description).toContain("TypeScript");
  });

  test("throws when build.yaml does not exist", () => {
    expect(() => loadBuildConfig("/nonexistent/plugin")).toThrow();
  });
});

// ─── strictFilterCards ────────────────────────────────────────────────────────

describe("strictFilterCards", () => {
  test("language=agnostic returns ONLY tdd-workflow (exact match)", () => {
    const result = strictFilterCards(allCards, { language: ["agnostic"] });
    const skills = result.map((c) => c.skill);
    expect(skills).toEqual(["tdd-workflow"]);
  });

  test("language=typescript returns ONLY ts-tdd (not tdd-workflow)", () => {
    const result = strictFilterCards(allCards, { language: ["typescript"] });
    const skills = result.map((c) => c.skill);
    expect(skills).toEqual(["ts-tdd"]);
  });

  test("language=python returns ONLY python-bdd", () => {
    const result = strictFilterCards(allCards, { language: ["python"] });
    const skills = result.map((c) => c.skill);
    expect(skills).toEqual(["python-bdd"]);
  });

  test("domain=testing with no language filter returns all 3", () => {
    const result = strictFilterCards(allCards, { domain: ["testing"] });
    expect(result).toHaveLength(3);
  });

  test("language=agnostic AND domain=testing returns tdd-workflow only", () => {
    const result = strictFilterCards(allCards, {
      language: ["agnostic"],
      domain: ["testing"],
    });
    const skills = result.map((c) => c.skill);
    expect(skills).toEqual(["tdd-workflow"]);
  });

  test("empty filters returns all cards", () => {
    const result = strictFilterCards(allCards, {});
    expect(result).toHaveLength(3);
  });

  test("no match returns empty array", () => {
    const result = strictFilterCards(allCards, { language: ["dotnet"] });
    expect(result).toHaveLength(0);
  });
});

// ─── resolveSkills ────────────────────────────────────────────────────────────

describe("resolveSkills", () => {
  test("methodology config returns tdd-workflow only (agnostic strict match)", () => {
    const config = loadBuildConfig(join(PLUGIN_FIXTURES, "qsm-methodology"));
    const result = resolveSkills(config, allCards);
    const skills = result.map((c) => c.skill);
    expect(skills).toContain("tdd-workflow");
    expect(skills).not.toContain("ts-tdd");
    expect(skills).not.toContain("python-bdd");
  });

  test("typescript config returns ts-tdd only (strict match)", () => {
    const config = loadBuildConfig(join(PLUGIN_FIXTURES, "qsm-typescript-lang"));
    const result = resolveSkills(config, allCards);
    const skills = result.map((c) => c.skill);
    expect(skills).toContain("ts-tdd");
    expect(skills).not.toContain("tdd-workflow");
    expect(skills).not.toContain("python-bdd");
  });

  test("include adds skill even when no query matches it", () => {
    const config = loadBuildConfig(join(PLUGIN_FIXTURES, "qsm-typescript-lang"));
    // Override include to add tdd-workflow (which doesn't match language=typescript strictly)
    const configWithInclude = { ...config, include: ["tdd-workflow"] };
    const result = resolveSkills(configWithInclude, allCards);
    const skills = result.map((c) => c.skill);
    expect(skills).toContain("ts-tdd");
    expect(skills).toContain("tdd-workflow");
  });

  test("exclude removes skill even when query matched it", () => {
    const config = loadBuildConfig(join(PLUGIN_FIXTURES, "qsm-typescript-lang"));
    const configWithExclude = { ...config, exclude: ["ts-tdd"] };
    const result = resolveSkills(configWithExclude, allCards);
    const skills = result.map((c) => c.skill);
    expect(skills).not.toContain("ts-tdd");
  });

  test("config with no queries and include=[tdd-workflow] returns just tdd-workflow", () => {
    const config = loadBuildConfig(join(PLUGIN_FIXTURES, "qsm-typescript-lang"));
    const customConfig = { ...config, queries: [], include: ["tdd-workflow"] };
    const result = resolveSkills(customConfig, allCards);
    const skills = result.map((c) => c.skill);
    expect(skills).toEqual(["tdd-workflow"]);
  });

  test("config with no queries and no include returns empty", () => {
    const config = loadBuildConfig(join(PLUGIN_FIXTURES, "qsm-typescript-lang"));
    const customConfig = { ...config, queries: [], include: [] };
    const result = resolveSkills(customConfig, allCards);
    expect(result).toHaveLength(0);
  });
});

// ─── computeContentHash ───────────────────────────────────────────────────────

describe("computeContentHash", () => {
  test("is deterministic — same cards produce same hash", () => {
    const hash1 = computeContentHash(allCards);
    const hash2 = computeContentHash(allCards);
    expect(hash1).toBe(hash2);
  });

  test("is order-independent — sorted internally", () => {
    const reversed = [...allCards].reverse();
    const hash1 = computeContentHash(allCards);
    const hash2 = computeContentHash(reversed);
    expect(hash1).toBe(hash2);
  });

  test("changes when card body changes", () => {
    const original = computeContentHash(allCards);

    const modifiedCards = allCards.map((c) =>
      c.skill === "tdd-workflow"
        ? { ...c, body: `${c.body}\n\nExtra content added.` }
        : c
    );
    const modified = computeContentHash(modifiedCards);

    expect(original).not.toBe(modified);
  });

  test("returns a valid SHA-256 hex string (64 chars)", () => {
    const hash = computeContentHash(allCards);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("empty array produces a consistent hash", () => {
    const hash1 = computeContentHash([]);
    const hash2 = computeContentHash([]);
    expect(hash1).toBe(hash2);
  });
});

// ─── bumpVersion ─────────────────────────────────────────────────────────────

describe("bumpVersion", () => {
  test("patch bump: 1.0.0 → 1.0.1", () => {
    expect(bumpVersion("1.0.0", "patch")).toBe("1.0.1");
  });

  test("minor bump: 1.0.0 → 1.1.0", () => {
    expect(bumpVersion("1.0.0", "minor")).toBe("1.1.0");
  });

  test("major bump: 1.0.0 → 2.0.0", () => {
    expect(bumpVersion("1.0.0", "major")).toBe("2.0.0");
  });

  test("patch resets nothing: 1.2.3 → 1.2.4", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
  });

  test("minor resets patch: 1.2.3 → 1.3.0", () => {
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
  });

  test("major resets minor and patch: 1.2.3 → 2.0.0", () => {
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
  });

  test("invalid version string is returned unchanged", () => {
    expect(bumpVersion("not-a-version", "patch")).toBe("not-a-version");
  });
});

// ─── readBuildHash / writeBuildHash ───────────────────────────────────────────

describe("readBuildHash / writeBuildHash", () => {
  test("readBuildHash returns null when .build-hash does not exist", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    const result = readBuildHash(dir);
    expect(result).toBeNull();
  });

  test("writeBuildHash + readBuildHash roundtrip", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    const hash = "abc123def456";
    writeBuildHash(dir, hash);
    const result = readBuildHash(dir);
    expect(result).toBe(hash);
  });

  test("writeBuildHash overwrites previous hash", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    writeBuildHash(dir, "first-hash");
    writeBuildHash(dir, "second-hash");
    const result = readBuildHash(dir);
    expect(result).toBe("second-hash");
  });

  test("readBuildHash trims trailing whitespace", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    writeBuildHash(dir, "trimmed-hash");
    // writeBuildHash appends \n — readBuildHash must trim it
    const result = readBuildHash(dir);
    expect(result).toBe("trimmed-hash");
  });
});
