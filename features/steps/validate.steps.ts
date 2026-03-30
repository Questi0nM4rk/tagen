import { expect } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
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
  "a skill-graph with valid catalog cards",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();

    // Create the source SKILL.md files that validate checks for
    const sourcePaths = [
      "plugins/qsm-methodology/skills/tdd-workflow/SKILL.md",
      "plugins/qsm-typescript-lang/skills/ts-tdd/SKILL.md",
      "plugins/qsm-python-lang/skills/python-bdd/SKILL.md",
    ];
    for (const src of sourcePaths) {
      const fullPath = join(world.projectDir, src);
      await mkdir(join(fullPath, ".."), { recursive: true });
      await writeFile(fullPath, "# Generated\n", "utf-8");
    }

    // Also ensure all cross-referenced skills (enhances/composes) exist
    // tdd-workflow enhances bdd-workflow — add a stub
    const bddWorkflowCard = `---
skill: bdd-workflow
plugin: qsm-methodology
source: plugins/qsm-methodology/skills/bdd-workflow/SKILL.md
description: "BDD workflow stub."
tags:
  phase: [specification]
  domain: [testing]
  language: agnostic
  layer: methodology
  concerns: [testing]
iron_laws: []
composes: []
enhances: []
---

# BDD Workflow stub
`;
    await writeFile(
      join(world.projectDir, "skill-graph", "skills", "bdd-workflow.md"),
      bddWorkflowCard,
      "utf-8"
    );
    await mkdir(join(world.projectDir, "plugins/qsm-methodology/skills/bdd-workflow"), {
      recursive: true,
    });
    await writeFile(
      join(world.projectDir, "plugins/qsm-methodology/skills/bdd-workflow/SKILL.md"),
      "# BDD Workflow\n",
      "utf-8"
    );
  }
);

Given<TaGenWorld>(
  "a catalog card with phase: [invalid-phase]",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();

    const badCard = `---
skill: bad-card
plugin: qsm-test
source: plugins/qsm-test/skills/bad-card/SKILL.md
description: "A card with an invalid phase."
tags:
  phase: [invalid-phase]
  domain: [testing]
  language: agnostic
  layer: standards
  concerns: [testing]
iron_laws:
  - "Some law — WHY: test"
composes: []
enhances: []
---

# Bad Card

This card has an invalid phase value.
`;
    await writeFile(
      join(world.projectDir, "skill-graph", "skills", "bad-card.md"),
      badCard,
      "utf-8"
    );
  }
);

Given<TaGenWorld>("a catalog card with language: ruby", async (world: TaGenWorld) => {
  world.projectDir = await createProjectDir();

  const rubyCard = `---
skill: ruby-card
plugin: qsm-test
source: plugins/qsm-test/skills/ruby-card/SKILL.md
description: "A card with an unsupported language value."
tags:
  phase: [implementation]
  domain: [testing]
  language: ruby
  layer: standards
  concerns: [testing]
iron_laws:
  - "Some law — WHY: test"
composes: []
enhances: []
---

# Ruby Card

Card with unknown language tag.
`;
  await writeFile(
    join(world.projectDir, "skill-graph", "skills", "ruby-card.md"),
    rubyCard,
    "utf-8"
  );
});

// ─── When ─────────────────────────────────────────────────────────────────────

When<TaGenWorld>('I run "tagen validate"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["validate"], world.projectDir);
});

// ─── Then ─────────────────────────────────────────────────────────────────────

Then<TaGenWorld>("it exits 0", (world: TaGenWorld) => {
  expect(world.result?.exitCode).toBe(0);
});

Then<TaGenWorld>('it prints "All N cards valid"', (world: TaGenWorld) => {
  const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
  // The validate command prints "All N card(s) valid."
  expect(combined).toMatch(/All \d+ card/i);
  expect(combined).toContain("valid");
});

Then<TaGenWorld>("it exits non-zero", (world: TaGenWorld) => {
  expect(world.result?.exitCode).not.toBe(0);
});

Then<TaGenWorld>(
  'it prints an error containing "unknown phase value"',
  (world: TaGenWorld) => {
    const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
    expect(combined).toContain("unknown phase value");
  }
);

Then<TaGenWorld>(
  'it prints an error containing "unknown language value"',
  (world: TaGenWorld) => {
    const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
    expect(combined).toContain("unknown language value");
  }
);
