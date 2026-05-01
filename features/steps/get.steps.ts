import { expect } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { After, Before, Given, Then, When } from "@questi0nm4rk/feats";
import type { TaGenWorld } from "./shared.ts";
import { createProjectDir, resetSkills, runTagen } from "./shared.ts";

// ─── Lifecycle ────────────────────────────────────────────────────────────────

Before(async (world: TaGenWorld) => {
  world.result = undefined;
  world.flags = {};
});

After(async (world: TaGenWorld) => {
  if (world.projectDir) {
    await rm(world.projectDir, { recursive: true, force: true });
    world.projectDir = undefined;
  }
});

// ─── Given ───────────────────────────────────────────────────────────────────
// "a skill-graph with catalog cards" lives in list.steps.ts.
// @questi0nm4rk/feats shares step registrations globally within the runner.

const STRICT_REVIEW_CARD = `---
skill: strict-review
description: "Zero-tolerance PR/MR review."
tags:
  phase: [review]
  domain: [code-review]
  language: agnostic
  layer: methodology
  concerns: [review-automation]
provides: [review-methodology]
requires: [language-patterns]
emits: []
consumes: []
surface:
  triggers: []
core:
  files: []
deep:
  subagents: []
  slots:
    language-patterns: true
  validators: []
---

# Strict Review
`;

const CSHARP_PATTERNS_CARD = `---
skill: csharp-patterns
description: "C#/.NET language-specific review patterns."
tags:
  phase: [review]
  domain: [code-review]
  language: dotnet
  layer: reference
  concerns: [review-automation]
provides: [language-patterns]
requires: []
emits: []
consumes: []
surface:
  triggers: []
core:
  files: []
deep:
  subagents: []
  slots: {}
  validators: []
---

# C# Patterns
`;

Given<TaGenWorld>(
  "a skill-graph with v2 cards that satisfy all requires",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();
    const skillsDir = join(world.projectDir, "skill-graph", "skills");
    await Promise.all([
      writeFile(join(skillsDir, "strict-review.md"), STRICT_REVIEW_CARD, "utf-8"),
      writeFile(join(skillsDir, "csharp-patterns.md"), CSHARP_PATTERNS_CARD, "utf-8"),
    ]);
  }
);

Given<TaGenWorld>(
  "a skill-graph with a card whose requires are not satisfied",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();
    await resetSkills(world.projectDir);
    const skillsDir = join(world.projectDir, "skill-graph", "skills");
    await writeFile(join(skillsDir, "strict-review.md"), STRICT_REVIEW_CARD, "utf-8");
  }
);

// ─── When ─────────────────────────────────────────────────────────────────────

When<TaGenWorld>(
  'I run "tagen get --language dotnet --json"',
  async (world: TaGenWorld) => {
    if (!world.projectDir) throw new Error("projectDir not set");
    world.result = await runTagen(
      ["get", "--language", "dotnet", "--json"],
      world.projectDir
    );
  }
);

When<TaGenWorld>(
  'I run "tagen get --domain code-review --json"',
  async (world: TaGenWorld) => {
    if (!world.projectDir) throw new Error("projectDir not set");
    world.result = await runTagen(
      ["get", "--domain", "code-review", "--json"],
      world.projectDir
    );
  }
);

When<TaGenWorld>(
  'I run "tagen get --domain data-processing --json"',
  async (world: TaGenWorld) => {
    if (!world.projectDir) throw new Error("projectDir not set");
    world.result = await runTagen(
      ["get", "--domain", "data-processing", "--json"],
      world.projectDir
    );
  }
);

When<TaGenWorld>('I run "tagen get --language dotnet"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["get", "--language", "dotnet"], world.projectDir);
});

When<TaGenWorld>(
  'I run "tagen get --card strict-review --card csharp-patterns --json"',
  async (world: TaGenWorld) => {
    if (!world.projectDir) throw new Error("projectDir not set");
    world.result = await runTagen(
      ["get", "--card", "strict-review", "--card", "csharp-patterns", "--json"],
      world.projectDir
    );
  }
);

// ─── Then ─────────────────────────────────────────────────────────────────────

Then<TaGenWorld>(
  "the manifest contains keys modules, core, subagents, refs, validators, emits, consumes, warnings, slots",
  (world: TaGenWorld) => {
    const manifest = JSON.parse(world.result?.stdout ?? "{}") as Record<
      string,
      unknown
    >;
    const requiredKeys = [
      "modules",
      "core",
      "subagents",
      "refs",
      "validators",
      "emits",
      "consumes",
      "warnings",
      "slots",
    ] as const;
    for (const key of requiredKeys) {
      expect(manifest).toHaveProperty(key);
    }
  }
);

Then<TaGenWorld>("manifest.warnings is non-empty", (world: TaGenWorld) => {
  const manifest = JSON.parse(world.result?.stdout ?? "{}") as {
    warnings?: unknown[];
  };
  expect(Array.isArray(manifest.warnings)).toBe(true);
  expect((manifest.warnings ?? []).length).toBeGreaterThan(0);
});

Then<TaGenWorld>("it prints warnings to stderr", (world: TaGenWorld) => {
  expect((world.result?.stderr ?? "").length).toBeGreaterThan(0);
});

Then<TaGenWorld>(
  "it prints a compact summary line with card count and slot count",
  (world: TaGenWorld) => {
    const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
    // runGet non-JSON prints "N card(s), M slot(s), K warning(s)."
    expect(combined).toMatch(/\d+ card\(s\)/);
    expect(combined).toMatch(/\d+ slot\(s\)/);
  }
);

Then<TaGenWorld>(
  "manifest.modules contains only the named cards",
  (world: TaGenWorld) => {
    const manifest = JSON.parse(world.result?.stdout ?? "{}") as {
      modules?: string[];
    };
    const modules = manifest.modules ?? [];
    expect(modules).toContain("strict-review");
    expect(modules).toContain("csharp-patterns");
    // No other cards should appear — the --card override restricts the set
    expect(modules.length).toBe(2);
  }
);

Then<TaGenWorld>("manifest.slots is non-empty", (world: TaGenWorld) => {
  const manifest = JSON.parse(world.result?.stdout ?? "{}") as {
    slots?: unknown[];
  };
  expect(Array.isArray(manifest.slots)).toBe(true);
  expect((manifest.slots ?? []).length).toBeGreaterThan(0);
});

Then<TaGenWorld>("it exits 2", (world: TaGenWorld) => {
  expect(world.result?.exitCode).toBe(2);
});

Then<TaGenWorld>('it prints "No cards matched" to stderr', (world: TaGenWorld) => {
  expect(world.result?.stderr ?? "").toContain("No cards matched");
});
