import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runGet } from "../src/commands/get.ts";
import { loadAllCards } from "../src/lib/catalog.ts";
import type { Manifest } from "../src/lib/compose.ts";
import { loadProtocols } from "../src/lib/protocols.ts";
import { loadSubagents } from "../src/lib/subagents.ts";
import { captureBoth } from "./helpers/capture.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph");

// ─── runGet — JSON manifest output ────────────────────────────────────────────

describe("runGet — --json emits a manifest to stdout, warnings to stderr", () => {
  test("stdout is parseable JSON with the manifest top-level keys", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const protocols = loadProtocols(FIXTURES);
    const { stdout } = captureBoth(() =>
      runGet(
        cards,
        subs,
        protocols,
        FIXTURES,
        { domain: ["code-review"], language: "dotnet" },
        { json: true }
      )
    );
    const m = JSON.parse(stdout) as Manifest;
    for (const k of [
      "modules",
      "core",
      "subagents",
      "refs",
      "slots",
      "validators",
      "emits",
      "consumes",
      "warnings",
    ] as const) {
      expect(m).toHaveProperty(k);
    }
  });

  test("warnings go to stderr, not stdout (so JSON parse stays clean)", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const protocols = loadProtocols(FIXTURES);
    // strict-review alone produces an unmet language-patterns warning.
    const { stdout, stderr } = captureBoth(() =>
      runGet(
        cards,
        subs,
        protocols,
        FIXTURES,
        { cards: ["strict-review"] },
        { json: true }
      )
    );
    expect(stderr).toContain("language-patterns");
    // stdout must remain a valid manifest, not interleaved with warnings.
    expect(() => JSON.parse(stdout)).not.toThrow();
  });
});

// ─── runGet — slot-filler routing emits to refs[] (issue #23) ─────────────────

describe("runGet — slot-filler content routes to refs[] not core[]", () => {
  test("csharp-patterns (filler) content goes to refs[] tagged with the slot", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const protocols = loadProtocols(FIXTURES);
    const { stdout } = captureBoth(() =>
      runGet(
        cards,
        subs,
        protocols,
        FIXTURES,
        { domain: ["code-review"], language: "dotnet" },
        { json: true }
      )
    );
    const m = JSON.parse(stdout) as Manifest;
    expect(m.refs.some((r) => r.slot === "language-patterns")).toBe(true);
    expect(m.core.some((p) => p.includes("csharp-patterns"))).toBe(false);
  });

  test("strict-review (non-filler methodology) content goes to core[]", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const protocols = loadProtocols(FIXTURES);
    const { stdout } = captureBoth(() =>
      runGet(
        cards,
        subs,
        protocols,
        FIXTURES,
        { domain: ["code-review"], language: "dotnet" },
        { json: true }
      )
    );
    const m = JSON.parse(stdout) as Manifest;
    expect(m.core.some((p) => p.includes("strict-review"))).toBe(true);
  });
});

// ─── runGet — text mode is informational, not the manifest ────────────────────

describe("runGet — text mode (no --json)", () => {
  test("prints a summary, not the manifest JSON", () => {
    const cards = loadAllCards(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const protocols = loadProtocols(FIXTURES);
    const { stdout } = captureBoth(() =>
      runGet(
        cards,
        subs,
        protocols,
        FIXTURES,
        { domain: ["code-review"], language: "dotnet" },
        { json: false }
      )
    );
    expect(stdout).toContain("Composition for query");
    expect(stdout).toContain("Use --json for the full manifest");
  });
});
