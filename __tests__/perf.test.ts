import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAllCards, marketplaceRoot } from "../src/lib/catalog.ts";
import { compose, emptyQuery, knownTypesFromCards } from "../src/lib/compose.ts";

const PERF_BUDGET_MS = 500;
const CARD_COUNT = 100;

let tempRoot: string;
let brainDir: string;

beforeAll(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "tagen-perf-"));
  brainDir = join(tempRoot, "brain");
  generate100CardFixture(brainDir);
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("performance — 100-card budget", () => {
  test(`loadAllCards + compose < ${PERF_BUDGET_MS}ms`, () => {
    const start = performance.now();
    const { cards } = loadAllCards(brainDir);
    const knownTypes = knownTypesFromCards(cards);
    const root = marketplaceRoot(brainDir);
    const r = compose(
      cards,
      root,
      { ...emptyQuery(), positional: ["review-0", "lang-1"] },
      knownTypes
    );
    const elapsed = performance.now() - start;
    expect(r.manifest).toBeDefined();
    expect(cards.length).toBeGreaterThanOrEqual(CARD_COUNT);
    expect(elapsed).toBeLessThan(PERF_BUDGET_MS);
  });
});

function generate100CardFixture(brain: string): void {
  // Distribution: 30 lang, 20 framework, 20 methodology, 15 review, 10 subagent, 5 protocol.
  const generators: Array<() => void> = [];

  for (let i = 0; i < 30; i++) {
    generators.push(() =>
      writeCard(brain, "lang", `lang-${i}`, [`description: "lang ${i}"`])
    );
  }
  for (let i = 0; i < 20; i++) {
    generators.push(() =>
      writeCard(brain, "framework", `fw-${i}`, [`description: "fw ${i}"`])
    );
  }
  for (let i = 0; i < 20; i++) {
    generators.push(() =>
      writeCard(brain, "methodology", `meth-${i}`, [
        `description: "meth ${i}"`,
        "requires: [lang]",
      ])
    );
  }
  for (let i = 0; i < 15; i++) {
    generators.push(() =>
      writeCard(brain, "review", `review-${i}`, [
        `description: "review ${i}"`,
        "requires: [lang]",
        "subagents: [sub-0]",
      ])
    );
  }
  for (let i = 0; i < 10; i++) {
    generators.push(() =>
      writeCard(brain, "subagent", `sub-${i}`, [
        `description: "sub ${i}"`,
        "model: sonnet",
      ])
    );
  }
  for (let i = 0; i < 5; i++) {
    generators.push(() => writeProtocolCard(brain, `proto-${i}`));
  }

  for (const g of generators) g();
}

function writeCard(brain: string, type: string, name: string, fmLines: string[]): void {
  const dir = join(brain, type, name);
  mkdirSync(dir, { recursive: true });
  const fm = ["---", ...fmLines, "---", "", `# ${name}`, "", "Body."].join("\n");
  writeFileSync(join(dir, "CORE.md"), fm);
}

function writeProtocolCard(brain: string, name: string): void {
  const dir = join(brain, "protocol", name);
  mkdirSync(join(dir, "examples", "valid"), { recursive: true });
  mkdirSync(join(dir, "examples", "invalid"), { recursive: true });
  writeFileSync(
    join(dir, "CORE.md"),
    `---\ndescription: "proto ${name}"\n---\n\n# ${name}\n`
  );
  writeFileSync(
    join(dir, "schema.json"),
    JSON.stringify({
      type: "object",
      required: ["x"],
      properties: { x: { type: "number" } },
      additionalProperties: false,
    })
  );
  writeFileSync(join(dir, "validator.ts"), "#!/usr/bin/env bun\n// noop\n");
  writeFileSync(join(dir, "examples", "valid", "ok.json"), JSON.stringify({ x: 1 }));
  writeFileSync(
    join(dir, "examples", "invalid", "bad.json"),
    JSON.stringify({ x: "string" })
  );
}
