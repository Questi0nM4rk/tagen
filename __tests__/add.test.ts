import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { runAdd, type ScaffoldArgs, scaffoldCard } from "../src/commands/add.ts";
import type { CatalogCard, Vocabulary } from "../src/lib/types.ts";
import { loadVocabulary } from "../src/lib/vocabulary.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph");

// ─── scaffoldCard — pure function, easy to assert on ─────────────────────────

describe("scaffoldCard — emitted YAML frontmatter", () => {
  const args: ScaffoldArgs = {
    name: "my-skill",
    description: "Pretty good skill",
    phase: ["review"],
    domain: ["code-review"],
    language: "agnostic",
    layer: "methodology",
    concerns: [],
  };

  test("frontmatter starts and ends with --- on their own lines", () => {
    const out = scaffoldCard(args);
    const lines = out.split("\n");
    expect(lines[0]).toBe("---");
    const closingIdx = lines.indexOf("---", 1);
    expect(closingIdx).toBeGreaterThan(0);
  });

  test("includes every required dimension key", () => {
    const out = scaffoldCard(args);
    for (const key of [
      "skill:",
      "description:",
      "tags:",
      "phase:",
      "domain:",
      "language:",
      "layer:",
      "concerns:",
      "provides:",
      "requires:",
      "emits:",
      "consumes:",
      "surface:",
      "core:",
      "deep:",
    ]) {
      expect(out).toContain(key);
    }
  });

  test("body section appears after the frontmatter with the H1 heading", () => {
    const out = scaffoldCard(args);
    expect(out).toContain(`# ${args.name}`);
    expect(out).toContain(args.description);
  });

  test("escapes embedded double quotes in description", () => {
    const out = scaffoldCard({ ...args, description: 'Bad "quotes" inside' });
    expect(out).toContain('description: "Bad \\"quotes\\" inside"');
  });
});

// ─── runAdd — interactive flow with injected streams ─────────────────────────

const CARDS: CatalogCard[] = [];
let vocab: Vocabulary;
let tmpVault: string;

beforeEach(() => {
  vocab = loadVocabulary(FIXTURES);
  tmpVault = mkdtempSync(join(tmpdir(), "tagen-add-"));
  mkdirSync(join(tmpVault, "skills"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpVault, { recursive: true, force: true });
});

/**
 * Drive runAdd's prompts by feeding answers to a PassThrough stream. The
 * answers list MUST exactly mirror runAdd's prompt order; mismatches surface
 * as a hung readline (we time out). Each entry becomes one input line.
 *
 * We hook the test's output Writable: every time runAdd prints a prompt
 * containing a colon (`Skill name: `, `phase: `, …) we feed the next answer.
 * That keeps each `rl.question` resolution paired with one prompt and avoids
 * race conditions where readline misses early-pushed lines.
 */
function withScriptedInput(
  answers: string[],
  body: (input: PassThrough, output: Writable) => Promise<void>
): Promise<void> {
  const input = new PassThrough();
  let cursor = 0;
  let pending = "";
  const feedNext = (): void => {
    if (cursor < answers.length) {
      input.write(`${answers[cursor]}\n`);
      cursor++;
    }
  };
  const output = new Writable({
    write(chunk, _enc, cb) {
      pending += String(chunk);
      // Each rl.question() prompt ends with ': '. Feed one answer per prompt.
      while (pending.includes(": ")) {
        const idx = pending.indexOf(": ");
        pending = pending.slice(idx + 2);
        feedNext();
      }
      cb();
    },
  });
  return body(input, output);
}

describe("runAdd — happy path writes a card", () => {
  test("creates skills/<name>.md with all answered values", async () => {
    await withScriptedInput(
      [
        "new-card", // skill name
        "test description", // description
        "review", // phase (multi)
        "code-review", // domain (multi)
        "agnostic", // language (single)
        "methodology", // layer (single)
        "", // concerns (multi, optional)
      ],
      async (input, output) => {
        await runAdd(CARDS, vocab, tmpVault, { input, output });
      }
    );
    const filePath = join(tmpVault, "skills", "new-card.md");
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, "utf8");
    expect(content).toContain("skill: new-card");
    expect(content).toContain('description: "test description"');
    expect(content).toContain("phase: [review]");
    expect(content).toContain("language: agnostic");
  });
});

describe("runAdd — refuses to overwrite", () => {
  test("aborts when the skill name collides with an existing card", async () => {
    const existing: CatalogCard = {
      skill: "already-here",
      description: "x",
      summary: [],
      tags: {
        phase: ["review"],
        domain: ["code-review"],
        language: "agnostic",
        layer: "methodology",
        concerns: [],
      },
      provides: [],
      requires: [],
      emits: [],
      consumes: [],
      surface: { triggers: [] },
      core: { files: [] },
      deep: { subagents: [], refs: [], slots: {}, validators: [] },
      body: "",
      filePath: "",
      legacyFields: [],
    };
    // process.exit() is what abort() does; spy on it to keep the test alive.
    const origExit = process.exit;
    let exitCode: number | undefined;
    (process as unknown as { exit: (n?: number) => never }).exit = ((n?: number) => {
      exitCode = n;
      throw new Error("exit");
    }) as never;
    try {
      await withScriptedInput(["already-here"], async (input, output) => {
        await runAdd([existing], vocab, tmpVault, { input, output }).catch(
          () => undefined
        );
      });
    } finally {
      process.exit = origExit;
    }
    expect(exitCode).toBe(1);
  });
});
