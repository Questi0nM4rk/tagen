/**
 * perf.test.ts — performance gates per SPEC-tagen "Testing strategy":
 *   list     < 100 ms
 *   validate < 500 ms
 *   get      < 500 ms
 * on a 100-card fixture.
 *
 * Measures in-process compute (loaders + filter/composer/validator) — not
 * `bun run` startup, which would dominate at this catalog size. The spec's
 * thresholds are about tagen's own work, not the runtime cold-start tax.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGet } from "../src/commands/get.ts";
import { runList } from "../src/commands/list.ts";
import { runValidate } from "../src/commands/validate.ts";
import { loadCapabilities } from "../src/lib/capabilities.ts";
import { loadAllCards } from "../src/lib/catalog.ts";
import { loadProtocols } from "../src/lib/protocols.ts";
import { loadSubagents } from "../src/lib/subagents.ts";
import { loadVocabulary, repoRoot } from "../src/lib/vocabulary.ts";

const CARD_COUNT = 100;
const FIXTURES = join(import.meta.dir, "fixtures");

function cardYaml(skill: string): string {
  return `---
skill: ${skill}
description: "Auto-generated card #${skill}."
tags:
  phase: [review]
  domain: [code-review]
  language: agnostic
  layer: methodology
  concerns: [review-automation]
provides: []
requires: []
emits: []
consumes: []
surface:
  triggers: []
core:
  files: []
deep:
  subagents: []
  refs: []
  slots: {}
  validators: []
---

# ${skill}

Generated for perf benchmarks.
`;
}

let projectDir: string;
let vaultDir: string;

beforeAll(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "tagen-perf-"));
  vaultDir = join(projectDir, "skill-graph");
  await cp(join(FIXTURES, "skill-graph"), vaultDir, { recursive: true });
  await rm(join(vaultDir, "skills"), { recursive: true });
  await mkdir(join(vaultDir, "skills"), { recursive: true });
  await Promise.all(
    Array.from({ length: CARD_COUNT }, (_, i) => {
      const skill = `perf-card-${String(i).padStart(3, "0")}`;
      return writeFile(
        join(vaultDir, "skills", `${skill}.md`),
        cardYaml(skill),
        "utf-8"
      );
    })
  );
});

afterAll(async () => {
  if (projectDir) await rm(projectDir, { recursive: true, force: true });
});

/** Run an in-process command and return wallclock ms. process.exit is
 * stubbed to a throwing sentinel so the timer captures the real work. */
const EXIT_SENTINEL = Symbol("perf.process.exit");
function timed(fn: () => void): number {
  const realExit = process.exit;
  // biome-ignore lint/suspicious/noExplicitAny: stubbing exit signature
  (process as any).exit = (() => {
    throw EXIT_SENTINEL;
  }) as never;
  // Suppress stdout/stderr writes inside the timer — JSON dump in `get`
  // dominates measured time otherwise.
  const realOut = process.stdout.write;
  const realErr = process.stderr.write;
  process.stdout.write = (() => true) as typeof process.stdout.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  const start = performance.now();
  try {
    fn();
  } catch (e) {
    if (e !== EXIT_SENTINEL) throw e;
  } finally {
    process.stdout.write = realOut;
    process.stderr.write = realErr;
    process.exit = realExit;
  }
  return performance.now() - start;
}

describe(`perf — ${CARD_COUNT}-card fixture`, () => {
  test("tagen list < 100ms", () => {
    const cards = loadAllCards(vaultDir);
    const ms = timed(() => runList(cards, {}, { json: false }));
    expect(ms).toBeLessThan(100);
  });

  test("tagen validate < 500ms", () => {
    const vocab = loadVocabulary(vaultDir);
    const cards = loadAllCards(vaultDir);
    const capabilities = loadCapabilities(vaultDir);
    const protocols = loadProtocols(vaultDir);
    const subagents = loadSubagents(vaultDir);
    const ms = timed(() =>
      runValidate(cards, vocab, capabilities, protocols, subagents, repoRoot(vaultDir))
    );
    expect(ms).toBeLessThan(500);
  });

  test("tagen get --json < 500ms", () => {
    const cards = loadAllCards(vaultDir);
    const subagents = loadSubagents(vaultDir);
    const protocols = loadProtocols(vaultDir);
    const ms = timed(() =>
      runGet(
        cards,
        subagents,
        protocols,
        repoRoot(vaultDir),
        { domain: ["code-review"] },
        {
          json: true,
          dryRun: false,
        }
      )
    );
    expect(ms).toBeLessThan(500);
  });
});
