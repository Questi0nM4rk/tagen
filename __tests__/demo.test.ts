import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runDemo } from "../src/commands/demo.ts";
import { loadAllCards } from "../src/lib/catalog.ts";
import { loadSubagents } from "../src/lib/subagents.ts";
import { captureStdout } from "./helpers/capture.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph");

// ─── runDemo — section ordering ───────────────────────────────────────────────

describe("runDemo — section ordering matches SPEC example", () => {
  test("Modules → Capabilities → Slots → Protocols → Subagents → Context → Warnings", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() =>
      runDemo(cards, subs, { domain: ["code-review"], language: "dotnet" })
    );
    const order = [
      "Modules:",
      "Capabilities:",
      "Slots",
      "Protocols:",
      "Subagents:",
      "Context:",
      "Warnings",
    ];
    let last = -1;
    for (const marker of order) {
      const idx = out.indexOf(marker);
      expect(idx).toBeGreaterThan(last);
      last = idx;
    }
  });
});

// ─── runDemo — slot-fill OK marker (issue #17) ────────────────────────────────

describe("runDemo — required: line annotates fill status (issue #17)", () => {
  test("filled requirement renders as 'cap OK (filled by <card>)'", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() =>
      runDemo(cards, subs, { domain: ["code-review"], language: "dotnet" })
    );
    expect(out).toContain("language-patterns OK (filled by csharp-patterns)");
  });

  test("unfilled requirement renders as 'cap UNMET'", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    // strict-review alone — no language-patterns provider in matched set.
    const out = captureStdout(() => runDemo(cards, subs, { cards: ["strict-review"] }));
    expect(out).toContain("language-patterns UNMET");
  });
});

// ─── runDemo — context-cost line (issue #17) ──────────────────────────────────

describe("runDemo — Context: line (issue #17)", () => {
  test("includes the Context: line with core/deep counts", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() =>
      runDemo(cards, subs, { domain: ["code-review"], language: "dotnet" })
    );
    expect(out).toMatch(/Context:\s+core\s+\d+\s+files?\s+\(~\d+\s+tok\)/);
    expect(out).toMatch(
      /deep\s+\d+\s+subagents\s+\+\s+\d+\s+refs\s+\+\s+\d+\s+validators/
    );
  });

  test("singular 'file' for core count of 1", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() => runDemo(cards, subs, { cards: ["strict-review"] }));
    // strict-review fixture has 1 core file.
    expect(out).toMatch(/Context:\s+core\s+1\s+file\s/);
  });
});

// ─── runDemo — slot section ───────────────────────────────────────────────────

describe("runDemo — Slots section", () => {
  test("renders each slot as 'capability ← fillerCard'", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() =>
      runDemo(cards, subs, { domain: ["code-review"], language: "dotnet" })
    );
    expect(out).toContain("language-patterns ← csharp-patterns");
  });

  test("'(none)' when there are no slots to fill", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() =>
      runDemo(cards, subs, { cards: ["csharp-patterns"] })
    );
    expect(out).toContain("Slots (0)");
  });
});

// ─── runDemo — verbose ────────────────────────────────────────────────────────

describe("runDemo — verbose", () => {
  test("--verbose appends a Resolution trace section", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() =>
      runDemo(
        cards,
        subs,
        { domain: ["code-review"], language: "dotnet" },
        { verbose: true }
      )
    );
    expect(out).toContain("Resolution trace:");
  });
});
