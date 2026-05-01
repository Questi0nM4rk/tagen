import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { runAdd, scaffoldCard } from "../src/commands/add.ts";
import { loadAllCards } from "../src/lib/catalog.ts";
import { knownTypesFromCards } from "../src/lib/compose.ts";
import { parseCore } from "../src/lib/frontmatter.ts";

const FIXTURE_BRAIN = join(import.meta.dir, "fixtures", "brain");

describe("scaffoldCard", () => {
  test("emits only the fields that were provided", () => {
    const out = scaffoldCard({
      type: "lang",
      name: "ruby",
      description: "Ruby patterns",
      aliases: [],
      requires: [],
      subagents: [],
    });
    const parsed = parseCore(out, "lang");
    expect(parsed.errors).toEqual([]);
    expect(parsed.frontmatter.description).toBe("Ruby patterns");
    expect(parsed.frontmatter.aliases).toBeUndefined();
    expect(parsed.frontmatter.requires).toBeUndefined();
  });

  test("review card with subagents emits subagents field", () => {
    const out = scaffoldCard({
      type: "review",
      name: "minimal",
      description: "min review",
      aliases: ["m"],
      requires: ["lang"],
      subagents: ["security-reviewer"],
    });
    const parsed = parseCore(out, "review");
    expect(parsed.errors).toEqual([]);
    expect(parsed.frontmatter.subagents).toEqual(["security-reviewer"]);
  });

  test("subagent card emits model field", () => {
    const out = scaffoldCard({
      type: "subagent",
      name: "noop",
      description: "no-op",
      aliases: [],
      requires: [],
      subagents: [],
      model: "haiku",
    });
    const parsed = parseCore(out, "subagent");
    expect(parsed.errors).toEqual([]);
    expect(parsed.frontmatter.model).toBe("haiku");
  });

  test("escapes double-quotes in description", () => {
    const out = scaffoldCard({
      type: "lang",
      name: "x",
      description: 'has "quotes"',
      aliases: [],
      requires: [],
      subagents: [],
    });
    expect(out).toContain('description: "has \\"quotes\\""');
  });
});

function withScriptedStdin(answers: string[]): { input: Readable; output: Writable } {
  // Async generator: yields one answer per readline.question(), so the stream
  // doesn't close before readline has subscribed and asked.
  async function* drip(): AsyncGenerator<string> {
    for (const a of answers) {
      await new Promise((r) => setImmediate(r));
      yield `${a}\n`;
    }
  }
  const input = Readable.from(drip());
  const output = new Writable({
    write(_chunk: unknown, _enc: unknown, cb: () => void): void {
      cb();
    },
  });
  return { input, output };
}

describe("runAdd — interactive scaffold", () => {
  test("creates brain/<type>/<name>/CORE.md with references/", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "tagen-add-"));
    try {
      const { cards } = loadAllCards(FIXTURE_BRAIN);
      const knownTypes = knownTypesFromCards(cards);
      const newBrain = join(tmp, "brain");
      const streams = withScriptedStdin([
        "lang", // type
        "ruby", // name
        "Ruby patterns", // description
        "rb", // aliases
        "", // requires (empty)
      ]);

      // Stub stdout so prompt echoes don't pollute the test runner.
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((): boolean => true) as typeof process.stdout.write;
      try {
        await runAdd(cards, knownTypes, newBrain, streams);
      } finally {
        process.stdout.write = origWrite;
      }

      const corePath = join(newBrain, "lang", "ruby", "CORE.md");
      expect(existsSync(corePath)).toBe(true);
      expect(existsSync(join(newBrain, "lang", "ruby", "references"))).toBe(true);

      const text = readFileSync(corePath, "utf8");
      const parsed = parseCore(text, "lang");
      expect(parsed.errors).toEqual([]);
      expect(parsed.frontmatter.description).toBe("Ruby patterns");
      expect(parsed.frontmatter.aliases).toEqual(["rb"]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
