import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const ENTRY = join(ROOT, "src", "main.ts");
const FIXTURES = join(ROOT, "__tests__", "fixtures");
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

describe("tagen --root <dir>", () => {
  test("get resolves from an unrelated cwd and emits the override root", async () => {
    const result = await runFromUnrelatedCwd([
      "get",
      "strict",
      "csharp",
      "--json",
      "--root",
      FIXTURES,
    ]);

    expect(result.exitCode).toBe(0);
    const manifest = JSON.parse(result.stdout) as {
      root: string;
      modules: Array<{ type: string; name: string }>;
    };
    expect(manifest.root).toBe(FIXTURES);
    expect(
      manifest.modules.find(
        (module) => module.type === "lang" && module.name === "csharp"
      )
    ).toBeDefined();
  });

  test("list resolves from an unrelated cwd", async () => {
    const result = await runFromUnrelatedCwd(["list", "--root", FIXTURES]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("lang/csharp");
  });

  test("validate resolves from an unrelated cwd", async () => {
    const result = await runFromUnrelatedCwd(["validate", "--root", FIXTURES]);
    expect(result.exitCode).toBe(0);
  });

  test("fails clearly when <dir>/brain is absent", async () => {
    const empty = mkdtempSync(join(tmpdir(), "tagen-cli-no-brain-"));
    try {
      const result = await runFromUnrelatedCwd(["list", "--root", empty]);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("no brain/ directory at");
      expect(result.stderr).toContain(empty);
      expect(result.stderr).toContain("--root");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  test("requires a value", async () => {
    const result = await runFromUnrelatedCwd(["list", "--root"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--root requires a value");
  });

  test("is rejected by add, which still uses cwd discovery", async () => {
    const result = await runCli(["add", "--root", FIXTURES]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--root is not valid for 'add'");
  });
});

async function runFromUnrelatedCwd(args: string[]): ReturnType<typeof runCli> {
  const cwd = mkdtempSync(join(tmpdir(), "tagen-unrelated-cwd-"));
  try {
    return await runCli(args, cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
