import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const ENTRY = join(ROOT, "src", "main.ts");
const PKG_VERSION = (
  JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    version: string;
  }
).version;

async function runCli(
  args: string[],
  cwd: string = ROOT
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const proc = Bun.spawn(["bun", "run", ENTRY, ...args], {
    cwd,
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

  test("compiled standalone binary prints the package version", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "tagen-compiled-"));
    const binary = join(tmp, "tagen");
    try {
      const build = Bun.spawn(
        ["bun", "build", ENTRY, "--compile", "--outfile", binary],
        {
          cwd: ROOT,
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      expect(await build.exited).toBe(0);

      const proc = Bun.spawn([binary, "--version"], {
        cwd: "/tmp",
        stdout: "pipe",
        stderr: "pipe",
      });
      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      expect(exitCode).toBe(0);
      expect(stderr).toBe("");
      expect(stdout.trim()).toBe(PKG_VERSION);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ─── help shape ───────────────────────────────────────────────────────────────

describe("tagen --help / -h", () => {
  test("--help lists the four commands", async () => {
    const r = await runCli(["--help"]);
    expect(r.exitCode).toBe(0);
    for (const cmd of ["validate", "list", "get", "add"]) {
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

  test("unknown options fail instead of becoming fuzzy query arguments", async () => {
    const r = await runCli(["get", "--bogus"]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("unknown option: --bogus");
  });

  test("known options are rejected on commands that do not support them", async () => {
    const r = await runCli(["list", "--verbose"]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("--verbose is not valid for 'list'");
  });

  test("non-get commands reject ignored positional arguments", async () => {
    const r = await runCli(["validate", "ignored"]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("unexpected positional argument");
  });

  test("list fails on malformed cards instead of returning a partial catalog", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "tagen-malformed-list-"));
    try {
      const card = join(tmp, "brain", "lang", "broken");
      mkdirSync(card, { recursive: true });
      writeFileSync(join(card, "CORE.md"), "# missing frontmatter\n");
      const proc = Bun.spawn(["bun", "run", ENTRY, "list"], {
        cwd: tmp,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      expect(exitCode).toBe(1);
      expect(stdout).toBe("");
      expect(stderr).toContain("CORE.md missing YAML frontmatter");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("get fails on malformed cards instead of composing a partial catalog", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "tagen-malformed-get-"));
    try {
      const valid = join(tmp, "brain", "lang", "valid");
      const broken = join(tmp, "brain", "lang", "broken");
      mkdirSync(valid, { recursive: true });
      mkdirSync(broken, { recursive: true });
      writeFileSync(join(valid, "CORE.md"), "---\ndescription: valid\n---\n# valid\n");
      writeFileSync(join(broken, "CORE.md"), "# missing frontmatter\n");

      const result = await runCli(["get", "valid", "--json"], tmp);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("CORE.md missing YAML frontmatter");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
