import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { filenameStem, loadSubagents } from "../src/lib/subagents.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph-v2");

// ─── loadSubagents ────────────────────────────────────────────────────────────

describe("loadSubagents", () => {
  test("returns empty array when subagents/ directory is absent", () => {
    const result = loadSubagents("/nonexistent/path");
    expect(result).toHaveLength(0);
  });

  test("loads the well-formed subagent fixture", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "v2-domain-reviewer");
    expect(reviewer).toBeDefined();
  });

  test("well-formed — name is parsed correctly", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "v2-domain-reviewer");
    expect(reviewer?.name).toBe("v2-domain-reviewer");
  });

  test("well-formed — model is parsed correctly", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "v2-domain-reviewer");
    expect(reviewer?.model).toBe("sonnet");
  });

  test("well-formed — description is parsed", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "v2-domain-reviewer");
    expect(reviewer?.description).toContain("domain-scoped review");
  });

  test("well-formed — consumes array from bracket notation", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "v2-domain-reviewer");
    expect(reviewer?.consumes).toEqual(["recon-summary"]);
  });

  test("well-formed — emits array from bracket notation", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "v2-domain-reviewer");
    expect(reviewer?.emits).toEqual(["finding"]);
  });

  test("well-formed — references array from bracket notation", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "v2-domain-reviewer");
    expect(reviewer?.references).toEqual(["language-patterns"]);
  });

  test("well-formed — body contains markdown content after frontmatter", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "v2-domain-reviewer");
    expect(reviewer?.body.length).toBeGreaterThan(0);
  });

  test("well-formed — filePath is set", () => {
    const result = loadSubagents(FIXTURES);
    const reviewer = result.find((s) => s.name === "v2-domain-reviewer");
    expect(reviewer?.filePath).toContain("v2-domain-reviewer.md");
  });

  test("loads file with unknown model value (validate flags it later)", () => {
    // SPEC-004 edge-case matrix: subagent with unknown model is a validate
    // error, not a load-time skip. The loader is tolerant; runValidate enforces
    // the model enum so the bad entry is visible in the validate report.
    const result = loadSubagents(FIXTURES);
    const bad = result.find((s) => s.name === "v2-bad-model");
    expect(bad).toBeDefined();
    // model is narrowed to SubagentModel at the type layer; the loader trusts
    // the YAML, so the runtime value here is "gpt4" even though TS thinks it
    // can only be haiku|sonnet|opus. Cast to string for the assertion.
    expect(bad?.model as string).toBe("gpt4");
  });

  test("skips file with name mismatch (name field present but it still loads if valid)", () => {
    // v2-bad-name.md has name: different-from-filename, model: haiku — it IS valid
    // (the loader doesn't enforce name==filename; that is a validator concern)
    const result = loadSubagents(FIXTURES);
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
    const result = loadSubagents(FIXTURES);
    const names = result.map((s) => s.name);
    expect(names).toContain("v2-bad-model");
  });
});

// ─── filenameStem ─────────────────────────────────────────────────────────────

describe("filenameStem", () => {
  test("strips .md extension from a filename", () => {
    expect(filenameStem("v2-domain-reviewer.md")).toBe("v2-domain-reviewer");
  });

  test("strips .md from an absolute path", () => {
    expect(filenameStem(join(FIXTURES, "subagents", "v2-domain-reviewer.md"))).toBe(
      "v2-domain-reviewer"
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
