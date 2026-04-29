import { expect } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Given, Then, When } from "@questi0nm4rk/feats";
import type { TaGenWorld } from "./shared.ts";
import { createProjectDir, runTagen } from "./shared.ts";

// Lifecycle hooks live in common.steps.ts.

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

// ─── v2 Given ────────────────────────────────────────────────────────────────

Given<TaGenWorld>(
  "a catalog card with an unknown capability in provides",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();

    const card = `---
skill: bad-provides
plugin: qsm-test
description: "Card with an unknown capability in provides."
tags:
  phase: [review]
  domain: [code-review]
  language: agnostic
  layer: methodology
  concerns: [review-automation]
provides: [non-existent-capability]
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

# Bad Provides Card
`;
    await writeFile(
      join(world.projectDir, "skill-graph", "skills", "bad-provides.md"),
      card,
      "utf-8"
    );
  }
);

Given<TaGenWorld>(
  "a v2 card with a core.files entry that does not exist on disk",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();

    const card = `---
skill: missing-core-file
plugin: qsm-test
description: "Card whose core.files entry does not exist."
tags:
  phase: [review]
  domain: [code-review]
  language: agnostic
  layer: methodology
  concerns: [review-automation]
provides: []
requires: []
emits: []
consumes: []
surface:
  triggers: []
core:
  files:
    - refs/does-not-exist.md
deep:
  subagents: []
  slots: {}
  validators: []
---

# Missing Core File Card
`;
    await writeFile(
      join(world.projectDir, "skill-graph", "skills", "missing-core-file.md"),
      card,
      "utf-8"
    );
    // Intentionally do NOT create brain/missing-core-file/refs/does-not-exist.md
  }
);

Given<TaGenWorld>(
  "a protocol directory without schema.json",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();

    // Create a protocol dir with only a protocol.md but no schema.json
    const protoDir = join(
      world.projectDir,
      "skill-graph",
      "protocols",
      "no-schema-protocol"
    );
    await mkdir(protoDir, { recursive: true });
    await writeFile(
      join(protoDir, "protocol.md"),
      "# Protocol: no-schema-protocol\n\nMissing schema.json intentionally.\n",
      "utf-8"
    );
    // Intentionally omit schema.json, validator.ts, and examples/
  }
);

Given<TaGenWorld>(
  "a subagent whose frontmatter name differs from its filename",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();

    // The fixture v2-bad-name.md already has name: different-from-filename
    // Copy it into the project's subagents directory
    const subagentsDir = join(world.projectDir, "skill-graph", "subagents");
    await mkdir(subagentsDir, { recursive: true });
    await writeFile(
      join(subagentsDir, "v2-bad-name.md"),
      `---
name: different-from-filename
model: haiku
description: "Subagent whose name frontmatter does not match filename."
consumes: []
emits: []
references: []
---

# Bad Name Subagent
`,
      "utf-8"
    );
  }
);

Given<TaGenWorld>(
  "a subagent with an unknown model value",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();

    const subagentsDir = join(world.projectDir, "skill-graph", "subagents");
    await mkdir(subagentsDir, { recursive: true });
    await writeFile(
      join(subagentsDir, "v2-bad-model.md"),
      `---
name: v2-bad-model
model: gpt4
description: "Subagent with an unknown model value."
consumes: []
emits: []
references: []
---

# Bad Model Subagent
`,
      "utf-8"
    );
  }
);

Given<TaGenWorld>(
  "a v1-only catalog card with iron_laws and composes fields",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();

    // The default fixture (tdd-workflow.md) already uses iron_laws + enhances.
    // ts-tdd.md uses composes. These are loaded by createProjectDir() via SKILL_GRAPH_FIXTURES.
    // Add a source file so source-exists check passes for the enhances target.
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

    // bdd-workflow is referenced by tdd-workflow's enhances — add a stub
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

// ─── v2 Then ─────────────────────────────────────────────────────────────────

Then<TaGenWorld>(
  'it prints an error containing "unknown capability in provides"',
  (world: TaGenWorld) => {
    const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
    expect(combined).toContain("unknown capability in provides");
  }
);

Then<TaGenWorld>(
  'it prints an error containing "path not found"',
  (world: TaGenWorld) => {
    const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
    expect(combined).toContain("path not found");
  }
);

Then<TaGenWorld>(
  'it prints an error containing "missing schema.json"',
  (world: TaGenWorld) => {
    const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
    expect(combined).toContain("missing schema.json");
  }
);

Then<TaGenWorld>(
  'it prints an error containing "does not match filename"',
  (world: TaGenWorld) => {
    const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
    expect(combined).toContain("does not match filename");
  }
);

Then<TaGenWorld>(
  'it prints an error containing "unknown model"',
  (world: TaGenWorld) => {
    const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
    expect(combined).toContain("unknown model");
  }
);

Then<TaGenWorld>("it prints a deprecation warning", (world: TaGenWorld) => {
  const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
  // Deprecation warnings use "deprecated" in the message
  expect(combined).toMatch(/deprecated/i);
});
