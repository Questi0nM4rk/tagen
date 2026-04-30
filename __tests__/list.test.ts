import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runList, runListSubagents } from "../src/commands/list.ts";
import { loadAllCards } from "../src/lib/catalog.ts";
import { loadSubagents } from "../src/lib/subagents.ts";
import { captureStdout } from "./helpers/capture.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph");

// ─── runList — JSON shape (issue #18 — surface provides/requires/tier counts) ─

describe("runList — JSON output", () => {
  test("each card carries provides + requires + emits + consumes", () => {
    const cards = loadAllCards(FIXTURES);
    const out = captureStdout(() => runList(cards, {}, { json: true }));
    const arr = JSON.parse(out) as Record<string, unknown>[];
    expect(arr.length).toBeGreaterThan(0);
    for (const c of arr) {
      for (const k of ["provides", "requires", "emits", "consumes"]) {
        expect(c).toHaveProperty(k);
      }
    }
  });

  test("each card carries surface.triggers", () => {
    const cards = loadAllCards(FIXTURES);
    const out = captureStdout(() => runList(cards, {}, { json: true }));
    const arr = JSON.parse(out) as { surface: { triggers: unknown } }[];
    for (const c of arr) {
      expect(c.surface).toBeDefined();
      expect(Array.isArray(c.surface.triggers)).toBe(true);
    }
  });

  test("tier counts (core / deep) are integers, not file paths", () => {
    // SPEC: list is the discovery layer. Counts are enough — full paths
    // belong in the manifest. Surfacing paths here would bloat the response.
    const cards = loadAllCards(FIXTURES);
    const out = captureStdout(() => runList(cards, {}, { json: true }));
    const arr = JSON.parse(out) as {
      core: { files: number };
      deep: { subagents: number; refs: number; validators: number; slots: string[] };
    }[];
    for (const c of arr) {
      expect(typeof c.core.files).toBe("number");
      expect(typeof c.deep.subagents).toBe("number");
      expect(typeof c.deep.refs).toBe("number");
      expect(typeof c.deep.validators).toBe("number");
      expect(Array.isArray(c.deep.slots)).toBe(true);
    }
  });

  test("filter by domain narrows the result set", () => {
    const cards = loadAllCards(FIXTURES);
    const out = captureStdout(() =>
      runList(cards, { domain: ["code-review"] }, { json: true })
    );
    const arr = JSON.parse(out) as { tags: { domain: string[] } }[];
    expect(arr.length).toBeGreaterThan(0);
    for (const c of arr) {
      expect(c.tags.domain).toContain("code-review");
    }
  });

  test("language filter is inclusive (matches lang OR agnostic)", () => {
    const cards = loadAllCards(FIXTURES);
    const out = captureStdout(() =>
      runList(cards, { language: "dotnet" }, { json: true })
    );
    const arr = JSON.parse(out) as { tags: { language: string } }[];
    expect(arr.length).toBeGreaterThan(0);
    for (const c of arr) {
      expect(c.tags.language === "dotnet" || c.tags.language === "agnostic").toBe(true);
    }
  });
});

// ─── runList — text output ────────────────────────────────────────────────────

describe("runList — text output (SPEC example shape)", () => {
  test("emits provides: line for each card with provides", () => {
    const cards = loadAllCards(FIXTURES);
    const out = captureStdout(() => runList(cards, {}, { json: false }));
    expect(out).toContain("provides:");
  });

  test("emits requires: line for cards with requires", () => {
    const cards = loadAllCards(FIXTURES);
    const out = captureStdout(() =>
      runList(cards, { domain: ["code-review"] }, { json: false })
    );
    // strict-review fixture has requires: [language-patterns]
    expect(out).toContain("requires:");
  });

  test("emits tier counts line (core: N file, deep: ...)", () => {
    const cards = loadAllCards(FIXTURES);
    const out = captureStdout(() => runList(cards, {}, { json: false }));
    expect(out).toMatch(/core:\s+\d+\s+file/);
    expect(out).toMatch(/deep:/);
  });

  test("includes the description text under each header", () => {
    const cards = loadAllCards(FIXTURES);
    const out = captureStdout(() =>
      runList(cards, { domain: ["code-review"] }, { json: false })
    );
    // strict-review's description starts with this canonical phrase.
    expect(out).toContain("Zero-tolerance PR/MR review");
  });

  test("'No skills found.' for an empty match set", () => {
    const cards = loadAllCards(FIXTURES);
    const out = captureStdout(() =>
      runList(cards, { domain: ["nonexistent-domain"] }, { json: false })
    );
    expect(out).toContain("No skills found");
  });
});

// ─── runListSubagents ─────────────────────────────────────────────────────────

describe("runListSubagents", () => {
  test("JSON output is an array of subagent objects", () => {
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() => runListSubagents(subs, { json: true }));
    const arr = JSON.parse(out) as Record<string, unknown>[];
    expect(arr.length).toBe(subs.length);
    for (const s of arr) {
      for (const k of ["name", "model", "description"]) {
        expect(s).toHaveProperty(k);
      }
    }
  });

  test("text output prints a NAME / MODEL / DESCRIPTION header", () => {
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() => runListSubagents(subs, { json: false }));
    expect(out).toContain("NAME");
    expect(out).toContain("MODEL");
    expect(out).toContain("DESCRIPTION");
  });
});
