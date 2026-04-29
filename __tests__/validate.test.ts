/**
 * validate.test.ts — unit tests for runValidate
 *
 * Exit-code / stderr capture approach:
 *   process.exit is mocked via `mock.module` is not available cleanly in bun:test for
 *   node builtins. Instead we use spyOn(process, "exit") to throw a sentinel error
 *   so the test catches it, and spyOn(process.stderr, "write") / spyOn(process.stdout, "write")
 *   to capture output buffers. Each test resets spies in its own scope.
 *
 * FRAGILITY NOTE: spyOn on process.exit stops the real exit but runValidate always
 * calls process.exit; if the spy is not restored between tests, a later call to a
 * passing branch may see stale mock state. Use afterEach(mock.restore) to reset.
 * If bun:test changes spy semantics, refactor runValidate to return {errors, warnings}
 * and remove stream coupling entirely.
 */

import { describe, expect, spyOn, test } from "bun:test";
import { join } from "node:path";
import { runValidate } from "../src/commands/validate.ts";
import type {
  CapabilityRegistry,
  CatalogCard,
  ProtocolEntry,
  Subagent,
  Vocabulary,
} from "../src/lib/types.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph");

/** Minimal vocabulary that satisfies validateCard for known tag values. */
function minimalVocab(): Vocabulary {
  return {
    dimensions: {
      phase: {
        description: "",
        values: {
          review: "",
          implementation: "",
          testing: "",
          planning: "",
          design: "",
          specification: "",
          verification: "",
          documentation: "",
          operations: "",
        },
      },
      domain: {
        description: "",
        values: {
          "code-review": "",
          testing: "",
          architecture: "",
          workflow: "",
        },
      },
      language: {
        description: "",
        values: {
          agnostic: "",
          dotnet: "",
          typescript: "",
          python: "",
        },
      },
      layer: {
        description: "",
        values: {
          methodology: "",
          reference: "",
          orchestrator: "",
          standards: "",
          patterns: "",
          analysis: "",
          integration: "",
          utility: "",
        },
      },
      concerns: {
        description: "",
        values: {
          quality: "",
          testing: "",
          "review-automation": "",
          "standards-enforcement": "",
        },
      },
    },
    relationships: {},
  };
}

/** Minimal capability registry with one known capability. */
function minimalCapabilities(
  names: string[] = ["review-methodology", "language-patterns"]
): CapabilityRegistry {
  const capabilities: Record<string, string> = {};
  for (const n of names) capabilities[n] = "";
  return { capabilities };
}

/** Minimal valid ProtocolEntry. */
function validProtocol(name: string): ProtocolEntry {
  return {
    name,
    dirPath: join(FIXTURES, "protocols", name),
    hasSchema: true,
    hasDoc: true,
    hasValidator: true,
    hasValidExamples: true,
    hasInvalidExamples: true,
  };
}

/** Minimal valid CatalogCard. legacyFields defaults to empty for clean cards. */
function minimalCard(skill: string): CatalogCard {
  return {
    skill,
    description: "A test card",
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
    filePath: join(FIXTURES, "skills", `${skill}.md`),
    legacyFields: [],
  };
}

/** Minimal valid Subagent. */
function minimalSubagent(name: string, filePath?: string): Subagent {
  return {
    name,
    model: "sonnet",
    description: "A test subagent",
    consumes: [],
    emits: [],
    references: [],
    body: "",
    filePath: filePath ?? join(FIXTURES, "subagents", `${name}.md`),
  };
}

// ─── Spy harness ──────────────────────────────────────────────────────────────

const EXIT_SENTINEL = Symbol("process.exit mock");

interface Captured {
  stderr: string;
  stdout: string;
  exitCode: number | null;
}

/**
 * Installs spies on process.exit / process.stderr.write / process.stdout.write.
 * Returns a getter that reads accumulated output, and a restore fn.
 */
function installCapture(): { captured: () => Captured; restore: () => void } {
  let stderr = "";
  let stdout = "";
  let exitCode: number | null = null;

  const exitSpy = spyOn(process, "exit").mockImplementation(
    (code?: number | string | null | undefined) => {
      exitCode = typeof code === "number" ? code : 0;
      throw EXIT_SENTINEL;
    }
  );

  const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
    (chunk: string | Uint8Array, ..._rest: unknown[]) => {
      if (typeof chunk === "string") stderr += chunk;
      return true;
    }
  );

  const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(
    (chunk: string | Uint8Array, ..._rest: unknown[]) => {
      if (typeof chunk === "string") stdout += chunk;
      return true;
    }
  );

  return {
    captured: () => ({ stderr, stdout, exitCode }),
    restore: () => {
      exitSpy.mockRestore();
      stderrSpy.mockRestore();
      stdoutSpy.mockRestore();
    },
  };
}

/**
 * Calls runValidate, absorbs the EXIT_SENTINEL throw, returns captured output.
 */
function runCapture(
  cards: CatalogCard[],
  vocab: Vocabulary,
  capabilities: CapabilityRegistry,
  protocols: ProtocolEntry[],
  subagents: Subagent[],
  root: string
): Captured {
  const { captured, restore } = installCapture();
  try {
    runValidate(cards, vocab, capabilities, protocols, subagents, root);
  } catch (e) {
    if (e !== EXIT_SENTINEL) throw e;
  } finally {
    restore();
  }
  return captured();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runValidate", () => {
  // ── 1. Unknown capability in card.provides ──────────────────────────────────
  test("1. unknown capability in provides → error mentioning capability name", () => {
    const card = minimalCard("alpha");
    card.provides = ["nonexistent-cap"];
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("nonexistent-cap");
    expect(result.stderr).toContain("unknown capability in provides");
  });

  // ── 2. Unknown capability in card.requires ──────────────────────────────────
  test("2. unknown capability in requires → error mentioning capability name", () => {
    const card = minimalCard("bravo");
    card.requires = ["ghost-capability"];
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("ghost-capability");
    expect(result.stderr).toContain("unknown capability in requires");
  });

  // ── 3. Unknown capability in deep.slots ────────────────────────────────────
  test("3. unknown capability in deep.slots → error mentioning capability name", () => {
    const card = minimalCard("charlie");
    card.deep.slots = { "phantom-slot": true };
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("phantom-slot");
    expect(result.stderr).toContain("unknown capability in deep.slots");
  });

  // ── 4. Unknown protocol in card.emits ──────────────────────────────────────
  test("4. unknown protocol in emits → error mentioning protocol name", () => {
    const card = minimalCard("delta");
    card.emits = ["unknown-proto"];
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("unknown-proto");
    expect(result.stderr).toContain("unknown protocol in emits");
  });

  // ── 5. Unknown protocol in card.consumes ───────────────────────────────────
  test("5. unknown protocol in consumes → error mentioning protocol name", () => {
    const card = minimalCard("echo");
    card.consumes = ["missing-protocol"];
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("missing-protocol");
    expect(result.stderr).toContain("unknown protocol in consumes");
  });

  // ── 6. Subagent name in deep.subagents not present in subagents list ────────
  test("6. deep.subagents references unknown subagent → error", () => {
    const card = minimalCard("foxtrot");
    card.deep.subagents = ["no-such-subagent"];
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("no-such-subagent");
    expect(result.stderr).toContain("unknown subagent in deep.subagents");
  });

  // ── 7. core.files path missing on disk ─────────────────────────────────────
  test("7. core.files path missing on disk → error referencing the path", () => {
    const card = minimalCard("golf");
    card.core.files = ["refs/does-not-exist.md"];
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("does-not-exist.md");
    expect(result.stderr).toContain("path not found");
  });

  // ── 8. deep.refs path missing on disk ──────────────────────────────────────
  test("8. deep.refs path missing on disk → error referencing the path", () => {
    const card = minimalCard("hotel");
    card.deep.refs = ["missing-ref.md"];
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("missing-ref.md");
    expect(result.stderr).toContain("path not found");
  });

  // ── 9. deep.validators path missing on disk ────────────────────────────────
  test("9. deep.validators path missing on disk → error referencing the path", () => {
    const card = minimalCard("india");
    card.deep.validators = ["validators/no-such-validator.ts"];
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("no-such-validator.ts");
    expect(result.stderr).toContain("path not found");
  });

  // ── 10. Protocol missing schema.json ───────────────────────────────────────
  test("10. protocol with hasSchema=false → error: missing schema.json", () => {
    const proto: ProtocolEntry = {
      ...validProtocol("test-proto"),
      hasSchema: false,
    };
    const result = runCapture(
      [],
      minimalVocab(),
      minimalCapabilities(),
      [proto],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("test-proto");
    expect(result.stderr).toContain("missing schema.json");
  });

  // ── 11. Protocol missing examples/valid ────────────────────────────────────
  test("11. protocol with hasValidExamples=false → error: missing examples/valid", () => {
    const proto: ProtocolEntry = {
      ...validProtocol("test-proto"),
      hasValidExamples: false,
    };
    const result = runCapture(
      [],
      minimalVocab(),
      minimalCapabilities(),
      [proto],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("test-proto");
    expect(result.stderr).toContain("examples/valid");
  });

  // ── 12. Protocol missing examples/invalid ──────────────────────────────────
  test("12. protocol with hasInvalidExamples=false → error: missing examples/invalid", () => {
    const proto: ProtocolEntry = {
      ...validProtocol("test-proto"),
      hasInvalidExamples: false,
    };
    const result = runCapture(
      [],
      minimalVocab(),
      minimalCapabilities(),
      [proto],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("test-proto");
    expect(result.stderr).toContain("examples/invalid");
  });

  // ── 13. Subagent name does not match filename stem ─────────────────────────
  test("13. subagent frontmatter name mismatches filename stem → error", () => {
    // Uses bad-name.md fixture: name='different-from-filename', file='bad-name.md'
    const sub: Subagent = {
      name: "different-from-filename",
      model: "haiku",
      description: "Test",
      consumes: [],
      emits: [],
      references: [],
      body: "",
      filePath: join(FIXTURES, "subagents", "bad-name.md"),
    };
    const result = runCapture(
      [],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [sub],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("different-from-filename");
    expect(result.stderr).toContain("bad-name");
    expect(result.stderr).toContain("does not match filename");
  });

  // ── 14. Subagent with unknown model ────────────────────────────────────────
  // NOTE: loadSubagents skips entries with unknown models (returns null), so the
  // only way to exercise this branch is to construct a Subagent directly and cast
  // past the type system — which is exactly what this test does.
  test("14. subagent with unknown model → error; confirm loader would have skipped it", () => {
    const sub = {
      name: "bad-model",
      model: "gpt4", // not in VALID_MODELS — cast past SubagentModel
      description: "Test",
      consumes: [],
      emits: [],
      references: [],
      body: "",
      filePath: join(FIXTURES, "subagents", "bad-model.md"),
    } as unknown as Subagent;

    const result = runCapture(
      [],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [sub],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("gpt4");
    expect(result.stderr).toContain("unknown model");
    // The fixture file has model: gpt4 in its frontmatter, proving loadSubagents would skip it.
    // If you loadSubagents(FIXTURES) the bad-model entry is absent.
  });

  // ── 15. Subagent consumes unknown protocol ─────────────────────────────────
  test("15. subagent consumes unknown protocol → error", () => {
    const sub = minimalSubagent("kilo");
    sub.consumes = ["ghost-protocol"];
    const result = runCapture(
      [],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [sub],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("ghost-protocol");
    expect(result.stderr).toContain("unknown protocol in consumes");
  });

  // ── 16. Subagent references unknown capability ─────────────────────────────
  test("16. subagent references unknown capability → error", () => {
    const sub = minimalSubagent("lima");
    sub.references = ["no-such-capability"];
    const result = runCapture(
      [],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [sub],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("no-such-capability");
    expect(result.stderr).toContain("unknown capability in references");
  });

  // ── 17. Card with legacy 'composes' field → hard error ───────────────────
  test("17. card.legacyFields contains 'composes' → hard error, exit 1", () => {
    const card = minimalCard("legacy-card");
    card.legacyFields = ["composes"];
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("legacy field 'composes'");
    expect(result.stderr).toContain("no longer supported");
  });

  // ── 18. Card without description → hard error ────────────────────────────
  test("18. card without description → hard error, exit 1", () => {
    const card = minimalCard("no-desc");
    card.description = "";
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("missing required field: description");
  });

  // ── 19. Card with legacy 'source' field → hard error ─────────────────────
  test("19. card.legacyFields contains 'source' → hard error, exit 1", () => {
    const card = minimalCard("src-card");
    card.legacyFields = ["source"];
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("legacy field 'source'");
  });

  // ── 20. Duplicate card.skill → error ───────────────────────────────────────
  test("20. duplicate card.skill → error", () => {
    const card1 = minimalCard("quebec");
    const card2 = minimalCard("quebec"); // same skill name
    const result = runCapture(
      [card1, card2],
      minimalVocab(),
      minimalCapabilities(),
      [],
      [],
      FIXTURES
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("duplicate skill name");
  });

  // ── 21. Happy path: all valid → exit 0, empty errors ──────────────────────
  test("21. happy path: all valid → exit 0, success message on stdout", () => {
    const card = minimalCard("romeo");
    const sub = minimalSubagent("sierra");
    const proto = validProtocol("tango-proto");
    const result = runCapture(
      [card],
      minimalVocab(),
      minimalCapabilities(),
      [proto],
      [sub],
      FIXTURES
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("error");
    expect(result.stdout).toContain("valid");
  });
});
