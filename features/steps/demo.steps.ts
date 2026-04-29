import { expect } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { After, Before, Given, Then, When } from "@questi0nm4rk/feats";
import type { TaGenWorld } from "./shared.ts";
import { createProjectDir, runTagen } from "./shared.ts";

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

Given<TaGenWorld>(
  "a skill-graph with v2 cards that satisfy all requires",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();

    const skillsDir = join(world.projectDir, "skill-graph", "skills");

    // v2-strict-review requires language-patterns; v2-csharp-patterns provides it.
    // Both are tagged language: dotnet (agnostic + dotnet) so --language dotnet matches both.
    await writeFile(
      join(skillsDir, "v2-strict-review.md"),
      `---
skill: v2-strict-review
plugin: qsm-strict-review
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
`,
      "utf-8"
    );

    await writeFile(
      join(skillsDir, "v2-csharp-patterns.md"),
      `---
skill: v2-csharp-patterns
plugin: qsm-dotnet-review
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
`,
      "utf-8"
    );
  }
);

Given<TaGenWorld>(
  "a skill-graph with a card whose requires are not satisfied",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();

    const skillsDir = join(world.projectDir, "skill-graph", "skills");

    // Only strict-review — no provider for language-patterns in the matched set
    await writeFile(
      join(skillsDir, "v2-strict-review.md"),
      `---
skill: v2-strict-review
plugin: qsm-strict-review
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
`,
      "utf-8"
    );
  }
);

Given<TaGenWorld>(
  "a skill-graph with two cards providing the same capability",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();

    const skillsDir = join(world.projectDir, "skill-graph", "skills");

    // v2-strict-review needs language-patterns; two cards provide it.
    await writeFile(
      join(skillsDir, "v2-strict-review.md"),
      `---
skill: v2-strict-review
plugin: qsm-strict-review
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
`,
      "utf-8"
    );

    await writeFile(
      join(skillsDir, "v2-csharp-patterns.md"),
      `---
skill: v2-csharp-patterns
plugin: qsm-dotnet-review
description: "C# language review patterns."
tags:
  phase: [review]
  domain: [code-review]
  language: agnostic
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
`,
      "utf-8"
    );

    await writeFile(
      join(skillsDir, "v2-ts-patterns.md"),
      `---
skill: v2-ts-patterns
plugin: qsm-ts-review
description: "TypeScript language review patterns."
tags:
  phase: [review]
  domain: [code-review]
  language: agnostic
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

# TypeScript Patterns
`,
      "utf-8"
    );
  }
);

// ─── When ─────────────────────────────────────────────────────────────────────

When<TaGenWorld>('I run "tagen demo --language dotnet"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["demo", "--language", "dotnet"], world.projectDir);
});

When<TaGenWorld>(
  'I run "tagen demo --domain code-review"',
  async (world: TaGenWorld) => {
    if (!world.projectDir) throw new Error("projectDir not set");
    world.result = await runTagen(
      ["demo", "--domain", "code-review"],
      world.projectDir
    );
  }
);

When<TaGenWorld>(
  'I run "tagen demo --domain data-processing"',
  async (world: TaGenWorld) => {
    if (!world.projectDir) throw new Error("projectDir not set");
    world.result = await runTagen(
      ["demo", "--domain", "data-processing"],
      world.projectDir
    );
  }
);

When<TaGenWorld>('I run "tagen demo --language cobol"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["demo", "--language", "cobol"], world.projectDir);
});

// ─── Then ─────────────────────────────────────────────────────────────────────

Then<TaGenWorld>("it prints matched card names", (world: TaGenWorld) => {
  const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
  // runDemo prints "Matched N card(s):" and lists skill names
  expect(combined).toMatch(/Matched \d+ card/i);
});

Then<TaGenWorld>("it prints slot fills", (world: TaGenWorld) => {
  const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
  // runDemo prints "Slot fills (N):"
  expect(combined).toMatch(/Slot fills/i);
});

Then<TaGenWorld>(
  'it prints a warning containing "unfilled slot"',
  (world: TaGenWorld) => {
    const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
    expect(combined).toContain("unfilled slot");
  }
);

Then<TaGenWorld>(
  "it prints a warning naming both provider candidates",
  (world: TaGenWorld) => {
    const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
    // The warning from compose() names all candidates: "multiple providers for..."
    expect(combined).toContain("multiple providers");
    expect(combined).toContain("v2-csharp-patterns");
    expect(combined).toContain("v2-ts-patterns");
  }
);

Then<TaGenWorld>("it exits 2", (world: TaGenWorld) => {
  expect(world.result?.exitCode).toBe(2);
});

Then<TaGenWorld>("it exits 1", (world: TaGenWorld) => {
  expect(world.result?.exitCode).toBe(1);
});

Then<TaGenWorld>('it prints "No cards matched" to stderr', (world: TaGenWorld) => {
  const stderr = world.result?.stderr ?? "";
  expect(stderr).toContain("No cards matched");
});

Then<TaGenWorld>(
  'it prints "unknown language value" to stderr',
  (world: TaGenWorld) => {
    const stderr = world.result?.stderr ?? "";
    expect(stderr).toContain("unknown language value");
  }
);
