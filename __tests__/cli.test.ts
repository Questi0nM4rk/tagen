import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const ENTRY = join(ROOT, "src", "main.ts");
const PKG_VERSION = (
  JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    version: string;
  }
).version;

async function runCli(args: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const proc = Bun.spawn(["bun", "run", ENTRY, ...args], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { exitCode: exitCode ?? 1, stdout, stderr };
}

// ─── --version / -V (issue #19) ───────────────────────────────────────────────

describe("tagen --version (issue #19)", () => {
  test("prints package.json version and exits 0", async () => {
    const r = await runCli(["--version"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe(PKG_VERSION);
  });

  test("'-V' is recognised as an alias for --version", async () => {
    const r = await runCli(["-V"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe(PKG_VERSION);
  });

  test("--version exits 0 even outside a skill-graph (no findVaultDir call)", async () => {
    // Run from /tmp where there is no skill-graph; --version must still work.
    const proc = Bun.spawn(["bun", "run", ENTRY, "--version"], {
      cwd: "/tmp",
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
    const [exitCode, stdout] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(PKG_VERSION);
  });
});

// ─── help shape ───────────────────────────────────────────────────────────────

describe("tagen --help / -h", () => {
  test("--help lists the six commands", async () => {
    const r = await runCli(["--help"]);
    expect(r.exitCode).toBe(0);
    for (const cmd of ["tags", "validate", "list", "demo", "get", "add"]) {
      expect(r.stdout).toContain(cmd);
    }
  });

  test("no args is equivalent to --help", async () => {
    const r = await runCli([]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Usage: tagen");
  });
});

// ─── unknown command ──────────────────────────────────────────────────────────

describe("tagen <unknown>", () => {
  test("unknown command exits 1 and points at --help", async () => {
    const r = await runCli(["bogus"]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("Unknown command");
    expect(r.stderr).toContain("--help");
  });
});
