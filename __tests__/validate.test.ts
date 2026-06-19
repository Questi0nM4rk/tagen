import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runValidate } from "../src/commands/validate.ts";
import { findBrainDir, loadAllCards, marketplaceRoot } from "../src/lib/catalog.ts";

const FIXTURES = join(import.meta.dir, "fixtures");
const CLEAN_BRAIN = join(FIXTURES, "brain");

function makeContext(brainDir: string) {
  const root = marketplaceRoot(brainDir);
  const { cards, protocols, frontmatterErrors } = loadAllCards(brainDir);
  return { cards, protocols, root, frontmatterErrors };
}

const ORIG_EXIT = process.exit;
const ORIG_STDERR = process.stderr.write.bind(process.stderr);

interface ValidateRun {
  exitCode: number;
  stderr: string;
}

function runAndCapture(brainDir: string, verbose = false): ValidateRun {
  let exitCode = 0;
  const chunks: string[] = [];
  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new Error("__exit__");
  }) as never;
  process.stderr.write = ((c: string | Uint8Array) => {
    chunks.push(typeof c === "string" ? c : Buffer.from(c).toString("utf8"));
    return true;
  }) as typeof process.stderr.write;
  try {
    runValidate(makeContext(brainDir), { verbose });
  } catch (err) {
    if (!(err instanceof Error && err.message === "__exit__")) throw err;
  } finally {
    process.exit = ORIG_EXIT;
    process.stderr.write = ORIG_STDERR;
  }
  return { exitCode, stderr: chunks.join("") };
}

/** Copy the clean brain into a temp dir, then mutate via fn. Returns the brain
 * dir path. Caller is responsible for cleanup via the returned tearDown. */
function cloneFixture(mutate: (brainDir: string) => void): {
  brainDir: string;
  tearDown: () => void;
} {
  const dir = mkdtempSync(join(tmpdir(), "tagen-validate-"));
  cpSync(CLEAN_BRAIN, join(dir, "brain"), { recursive: true });
  const brainDir = join(dir, "brain");
  mutate(brainDir);
  return {
    brainDir,
    tearDown: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe("runValidate — clean fixture", () => {
  test("exits 0 with no violations", () => {
    const { exitCode, stderr } = runAndCapture(findBrainDir(FIXTURES));
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
  });

  test("--verbose emits a scanned-count line", () => {
    const { stderr } = runAndCapture(findBrainDir(FIXTURES), true);
    expect(stderr).toContain("scanned");
    expect(stderr).toContain("violation(s)");
  });
});

describe("runValidate — broken cards", () => {
  test("unknown requires type", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "methodology", "tdd", "CORE.md"),
        `---\ndescription: "x"\nrequires: [no-such-type]\n---\n# x\n`
      );
    });
    try {
      const { exitCode, stderr } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("unknown type in requires: no-such-type");
    } finally {
      tearDown();
    }
  });

  test("unknown subagent reference", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "review", "strict", "CORE.md"),
        `---\ndescription: "x"\nrequires: [lang]\nsubagents: [ghost]\n---\n# x\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("unknown subagent in subagents: ghost");
    } finally {
      tearDown();
    }
  });

  test("subagents on non-review/methodology card rejected by frontmatter parser", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "lang", "csharp", "CORE.md"),
        `---\ndescription: "x"\nsubagents: [security-reviewer]\n---\n# x\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("unknown frontmatter field for type 'lang': subagents");
    } finally {
      tearDown();
    }
  });

  test("subagent without model is valid", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "subagent", "security-reviewer", "CORE.md"),
        `---\ndescription: "x"\n---\n# x\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(0);
      expect(stderr).toBe("");
    } finally {
      tearDown();
    }
  });

  test("subagent model metadata is rejected", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "subagent", "security-reviewer", "CORE.md"),
        `---\ndescription: "x"\nmodel: gpt4\n---\n# x\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("unknown frontmatter field for type 'subagent': model");
    } finally {
      tearDown();
    }
  });

  test("unknown card in uses", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "subagent", "security-reviewer", "CORE.md"),
        `---\ndescription: "x"\nuses: [methodology/missing]\n---\n# x\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("unknown card in uses: methodology/missing");
    } finally {
      tearDown();
    }
  });

  test("malformed uses target", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "subagent", "security-reviewer", "CORE.md"),
        `---\ndescription: "x"\nuses: [tdd]\n---\n# x\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("invalid uses target 'tdd'");
    } finally {
      tearDown();
    }
  });

  test("self use and uses cycles are rejected", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "subagent", "security-reviewer", "CORE.md"),
        `---\ndescription: "x"\nuses: [subagent/style-reviewer]\n---\n# x\n`
      );
      writeFileSync(
        join(b, "subagent", "style-reviewer", "CORE.md"),
        `---\ndescription: "x"\nuses: [subagent/security-reviewer]\n---\n# x\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain(
        "uses cycle: subagent/security-reviewer -> subagent/style-reviewer -> subagent/security-reviewer"
      );
    } finally {
      tearDown();
    }
  });

  test("harness-specific content reports file line rule and token", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "subagent", "security-reviewer", "CORE.md"),
        `---\ndescription: "x"\n---\n# x\n\nRun this with Claude Code using the sonnet tier.\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("harness leak [harness-name]: Claude Code");
      expect(stderr).toContain("harness leak [vendor-model-tier]: sonnet");
      expect(stderr).toContain("brain/subagent/security-reviewer/CORE.md:6");
    } finally {
      tearDown();
    }
  });

  test("guard config adds terms and narrowly allows rules", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      const root = join(b, "..");
      mkdirSync(join(root, ".tagen"), { recursive: true });
      writeFileSync(
        join(root, ".tagen", "agnostic-guard.json"),
        JSON.stringify({
          version: 1,
          additionalTerms: [
            {
              id: "local-harness",
              term: "HarnessX",
              caseSensitive: true,
            },
          ],
          allow: [
            {
              pathPrefix: "brain/architecture/cli/",
              rules: ["local-harness"],
            },
          ],
        })
      );
      writeFileSync(
        join(b, "architecture", "cli", "CORE.md"),
        `---\ndescription: "HarnessX comparison"\n---\n# HarnessX\n`
      );
      writeFileSync(
        join(b, "lang", "rust", "CORE.md"),
        `---\ndescription: "HarnessX patterns"\n---\n# Rust\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).not.toContain("brain/architecture/cli/CORE.md");
      expect(stderr).toContain(
        "brain/lang/rust/CORE.md:2: harness leak [local-harness]: HarnessX"
      );
    } finally {
      tearDown();
    }
  });

  test("invalid guard config is a validation failure", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      const root = join(b, "..");
      mkdirSync(join(root, ".tagen"), { recursive: true });
      writeFileSync(
        join(root, ".tagen", "agnostic-guard.json"),
        JSON.stringify({
          version: 1,
          allow: [{ pathPrefix: "../plugins/", rules: ["harness-name"] }],
        })
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("pathPrefix must stay under brain/");
    } finally {
      tearDown();
    }
  });

  test("additional guard terms cannot replace built-in rules", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      const root = join(b, "..");
      mkdirSync(join(root, ".tagen"), { recursive: true });
      writeFileSync(
        join(root, ".tagen", "agnostic-guard.json"),
        JSON.stringify({
          version: 1,
          additionalTerms: [
            {
              id: "harness-name",
              term: "anything",
              caseSensitive: false,
            },
          ],
        })
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain(
        "additionalTerms[0].id conflicts with built-in rule 'harness-name'"
      );
    } finally {
      tearDown();
    }
  });

  test("alias collision between cards", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "lang", "python", "CORE.md"),
        `---\ndescription: "x"\naliases: [dotnet]\n---\n# x\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("alias 'dotnet' collides between");
    } finally {
      tearDown();
    }
  });

  test("alias collides with canonical name", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "lang", "python", "CORE.md"),
        `---\ndescription: "x"\naliases: [csharp]\n---\n# x\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("collides with canonical name");
    } finally {
      tearDown();
    }
  });

  test("missing frontmatter description", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "lang", "rust", "CORE.md"),
        `---\naliases: []\n---\n# Rust\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("missing required frontmatter field: description");
    } finally {
      tearDown();
    }
  });

  test("invalid kebab-case card name", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      const target = join(b, "lang", "Bad_Name");
      mkdirSync(target, { recursive: true });
      writeFileSync(join(target, "CORE.md"), `---\ndescription: "x"\n---\n# x\n`);
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("card name must match");
    } finally {
      tearDown();
    }
  });

  test("CORE.md exceeds 300 lines", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      const body = Array.from({ length: 305 }, () => "line").join("\n");
      writeFileSync(
        join(b, "lang", "rust", "CORE.md"),
        `---\ndescription: "x"\n---\n${body}\n`
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("exceeds 300 lines");
    } finally {
      tearDown();
    }
  });

  test("validators dir on non-review/methodology card rejected", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      const dir = join(b, "lang", "csharp", "validators");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "rule.ts"), `// noop\n`);
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain(
        "validators/ allowed only on review and methodology cards"
      );
    } finally {
      tearDown();
    }
  });

  test("protocol invalid example passes schema → error", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      // Replace the invalid example with one that actually validates.
      writeFileSync(
        join(b, "protocol", "finding", "examples", "invalid", "missing-message.json"),
        JSON.stringify({ file: "x.ts", line: 1, message: "ok" })
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("passes schema (should fail)");
    } finally {
      tearDown();
    }
  });

  test("draft 2020-12 schemas validate without crashing", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "protocol", "finding", "schema.json"),
        JSON.stringify({
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          required: ["file", "line", "message"],
          properties: {
            file: { type: "string" },
            line: { type: "integer", minimum: 1 },
            message: { type: "string" },
          },
        })
      );
    });
    try {
      const { exitCode, stderr } = runAndCapture(brainDir);
      expect(exitCode).toBe(0);
      expect(stderr).toBe("");
    } finally {
      tearDown();
    }
  });

  test("protocol valid example fails schema → error", () => {
    const { brainDir, tearDown } = cloneFixture((b) => {
      writeFileSync(
        join(b, "protocol", "finding", "examples", "valid", "sample.json"),
        JSON.stringify({ file: "x.ts" }) // missing required fields
      );
    });
    try {
      const { stderr, exitCode } = runAndCapture(brainDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("fails schema");
    } finally {
      tearDown();
    }
  });
});
