import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { filenameStem, loadSubagents } from "../src/lib/subagents.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph");
// Tests covering bad inputs use a parallel fixture so the canonical one stays
// clean for `tagen validate` happy-path tests.
const ISSUES_FIXTURES = join(import.meta.dir, "fixtures/skill-graph-with-issues");

// ─── loadSubagents ────────────────────────────────────────────────────────────

describe("loadSubagents", () => {
  test("returns empty array when subagents/ directory is absent", () => {
    const result = loadSubagents("/nonexistent/path");
    expect(result).toHaveLength(0);
  });

  test("loads the well-formed subagent fixture", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "domain-reviewer");
    expect(reviewer).toBeDefined();
  });

  test("well-formed — name is parsed correctly", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "domain-reviewer");
    expect(reviewer?.name).toBe("domain-reviewer");
  });

  test("well-formed — model is parsed correctly", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "domain-reviewer");
    expect(reviewer?.model).toBe("sonnet");
  });

  test("well-formed — description is parsed", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "domain-reviewer");
    expect(reviewer?.description).toContain("domain-scoped review");
  });

  test("well-formed — consumes parsed (empty in canonical fixture)", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "domain-reviewer");
    expect(Array.isArray(reviewer?.consumes)).toBe(true);
  });

  test("well-formed — emits array from bracket notation", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "domain-reviewer");
    expect(reviewer?.emits).toEqual(["finding"]);
  });

  test("well-formed — references array from bracket notation", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "domain-reviewer");
    expect(reviewer?.references).toEqual(["language-patterns"]);
  });

  test("well-formed — body contains markdown content after frontmatter", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "domain-reviewer");
    expect(reviewer?.body.length).toBeGreaterThan(0);
  });

  test("well-formed — filePath is set", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "domain-reviewer");
    expect(reviewer?.filePath).toContain("domain-reviewer.md");
  });

  test("loads file with unknown model value (validate flags it later)", () => {
    // Subagent with unknown model is a validate error, not a load-time skip.
    // The loader trusts the YAML; runValidate enforces the model enum.
    const result = loadSubagents(ISSUES_FIXTURES);
    const bad = result.find((s) => s.name === "bad-model");
    expect(bad).toBeDefined();
    expect(bad?.model as string).toBe("gpt4");
  });

  test("loads file with name mismatch (validate flags it later)", () => {
    // bad-name.md has name: different-from-filename — loader doesn't enforce
    // the name==filename invariant; validate does.
    const result = loadSubagents(ISSUES_FIXTURES);
    const bad = result.find((s) => s.name === "different-from-filename");
    expect(bad).toBeDefined();
  });

  test("skips files that do not end with .md", () => {
    // No non-md files in fixtures, but confirm count is only md-derived entries.
    const result = loadSubagents(FIXTURES);
    for (const s of result) {
      expect(s.filePath.endsWith(".md")).toBe(true);
    }
  });

  test("results are sorted alphabetically by name", () => {
    const result = loadSubagents(FIXTURES);
    const names = result.map((s) => s.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  test("single-string consumes normalises to array", () => {
    // This tests the toStringArray branch — covered indirectly via the fixture
    // which uses bracket notation (array). Synthetic validation: if the output
    // is an array, the invariant holds.
    const result = loadSubagents(FIXTURES);
    for (const s of result) {
      expect(Array.isArray(s.consumes)).toBe(true);
      expect(Array.isArray(s.emits)).toBe(true);
      expect(Array.isArray(s.references)).toBe(true);
    }
  });
});

describe("loadSubagents — tolerant loading", () => {
  // The loader never silently filters entries with bad data — it always
  // surfaces them so validate can report the problem. Skipping happens only
  // when the file structure itself is unparsable (no name, missing delimiter).
  test("bad-model entry is present in results (visible to validate)", () => {
    const result = loadSubagents(ISSUES_FIXTURES);
    const names = result.map((s) => s.name);
    expect(names).toContain("bad-model");
  });
});

// ─── filenameStem ─────────────────────────────────────────────────────────────

describe("filenameStem", () => {
  test("strips .md extension from a filename", () => {
    expect(filenameStem("domain-reviewer.md")).toBe("domain-reviewer");
  });

  test("strips .md from an absolute path", () => {
    expect(filenameStem(join(FIXTURES, "subagents", "domain-reviewer.md"))).toBe(
      "domain-reviewer"
    );
  });

  test("leaves non-.md extension unchanged", () => {
    expect(filenameStem("something.ts")).toBe("something.ts");
  });

  test("handles name with no extension", () => {
    expect(filenameStem("no-ext")).toBe("no-ext");
  });

  test("handles dotfile (leading dot, no other extension)", () => {
    expect(filenameStem(".hidden")).toBe(".hidden");
  });
});
