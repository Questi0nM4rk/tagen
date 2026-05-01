import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runGet } from "../src/commands/get.ts";
import { loadAllCards, marketplaceRoot } from "../src/lib/catalog.ts";
import { type ComposeQuery, emptyQuery } from "../src/lib/compose.ts";
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

const ORIGINAL_EXIT = process.exit;
const ORIGINAL_STDERR = process.stderr.write.bind(process.stderr);
const ORIGINAL_STDOUT = process.stdout.write.bind(process.stdout);

interface ExitCapture {
  exitCode?: number;
  stderr: string;
  stdout: string;
}

/** Run fn() while stubbing process.exit, stderr, and stdout. Survives the
 * exit-throw and returns whatever was written before exit was called. */
function withExitCapture(fn: () => void): ExitCapture {
  const stderrChunks: string[] = [];
  const stdoutChunks: string[] = [];
  let exitCode: number | undefined;

  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new Error("__exit__");
  }) as never;
  process.stderr.write = ((c: string | Uint8Array) => {
    stderrChunks.push(typeof c === "string" ? c : Buffer.from(c).toString("utf8"));
    return true;
  }) as typeof process.stderr.write;
  process.stdout.write = ((c: string | Uint8Array) => {
    stdoutChunks.push(typeof c === "string" ? c : Buffer.from(c).toString("utf8"));
    return true;
  }) as typeof process.stdout.write;

  try {
    fn();
  } catch (err) {
    if (!(err instanceof Error && err.message === "__exit__")) throw err;
  } finally {
    process.exit = ORIGINAL_EXIT;
    process.stderr.write = ORIGINAL_STDERR;
    process.stdout.write = ORIGINAL_STDOUT;
  }

  return { exitCode, stderr: stderrChunks.join(""), stdout: stdoutChunks.join("") };
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
    const { exitCode, stderr } = withExitCapture(() =>
      runGet(cards, ROOT, q([]), { json: true })
    );
    expect(exitCode).toBe(2);
    expect(stderr).toContain("no cards matched");
  });

  test("ambiguous arg exits 1", () => {
    const { exitCode, stderr } = withExitCapture(() =>
      runGet(cards, ROOT, q(["dot"]), { json: true })
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("ambiguous arg");
  });
});
