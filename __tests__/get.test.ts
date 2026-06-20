import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { CommandResult } from "../src/cli/result.ts";
import { runGet } from "../src/commands/get.ts";
import { type ComposeQuery, emptyQuery } from "../src/composition/index.ts";
import { loadAllCards, marketplaceRoot } from "../src/lib/catalog.ts";
import { captureStderr, captureStdout } from "./helpers/capture.ts";

const BRAIN = join(import.meta.dir, "fixtures", "brain");
const ROOT = marketplaceRoot(BRAIN);
const { cards } = loadAllCards(BRAIN);

function q(
  positional: string[] = [],
  overrides: Partial<ComposeQuery> = {}
): ComposeQuery {
  return { ...emptyQuery(), positional, ...overrides };
}

describe("runGet — JSON manifest", () => {
  test("emits manifest with every required key", () => {
    const out = captureStdout(() =>
      runGet(cards, ROOT, q(["strict", "csharp"]), { json: true })
    );
    const m = JSON.parse(out) as Record<string, unknown>;
    for (const key of [
      "root",
      "modules",
      "core",
      "references",
      "filled",
      "slots",
      "subagents",
      "validators",
      "warnings",
    ]) {
      expect(m).toHaveProperty(key);
    }
  });

  test("warnings printed to stderr too", () => {
    let stdout = "";
    const stderr = captureStderr(() => {
      stdout = captureStdout(() => runGet(cards, ROOT, q(["strict"]), { json: true }));
    });
    expect(stderr).toContain("unfilled slot");
    const m = JSON.parse(stdout) as { warnings: string[] };
    expect(m.warnings.some((w) => w.includes("unfilled slot"))).toBe(true);
  });
});

describe("runGet — non-JSON summary", () => {
  test("compact summary line", () => {
    const out = captureStdout(() =>
      runGet(cards, ROOT, q(["strict", "csharp"]), { json: false })
    );
    expect(out).toMatch(/2 card\(s\), 1 slot\(s\), 0 warning\(s\)\./);
  });
});

describe("runGet — browse intent", () => {
  test("bare type-name positional delegates to runList", () => {
    const out = captureStdout(() =>
      runGet(cards, ROOT, q(["methodology"]), { json: false })
    );
    expect(out.trim()).toBe("methodology/tdd");
  });
});

describe("runGet — exit codes", () => {
  test("empty match exits 2", () => {
    let result = CommandResult.SUCCESS;
    const stderr = captureStderr(() => {
      result = runGet(cards, ROOT, q([]), { json: true });
    });
    expect(result.exitCode).toBe(2);
    expect(stderr).toContain("no cards matched");
  });

  test("ambiguous arg exits 1", () => {
    let result = CommandResult.SUCCESS;
    const stderr = captureStderr(() => {
      result = runGet(cards, ROOT, q(["dot"]), { json: true });
    });
    expect(result.exitCode).toBe(1);
    expect(stderr).toContain("ambiguous arg");
  });
});
