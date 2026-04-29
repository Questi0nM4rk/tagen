import { expect } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Given, Then, When } from "@questi0nm4rk/feats";
import type { TaGenWorld } from "./shared.ts";
import {
  createProjectDir,
  runTagen,
  VALID_TAGS_AND_TIERS,
  writeCard,
} from "./shared.ts";

// Lifecycle hooks live in common.steps.ts.

// ─── Given ───────────────────────────────────────────────────────────────────

Given<TaGenWorld>(
  "a catalog card with phase: [invalid-phase]",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();
    await writeCard(
      world.projectDir,
      "bad-phase.md",
      `---
skill: bad-phase
description: "Card with invalid phase."
tags:
  phase: [invalid-phase]
  domain: [code-review]
  language: agnostic
  layer: methodology
  concerns: []
---

# Bad Phase
`
    );
  }
);

Given<TaGenWorld>("a catalog card with language: ruby", async (world: TaGenWorld) => {
  world.projectDir = await createProjectDir();
  await writeCard(
    world.projectDir,
    "ruby-card.md",
    `---
skill: ruby-card
description: "Card with unsupported language."
tags:
  phase: [review]
  domain: [code-review]
  language: ruby
  layer: methodology
  concerns: []
---

# Ruby Card
`
  );
});

Given<TaGenWorld>(
  "a catalog card with an unknown capability in provides",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();
    await writeCard(
      world.projectDir,
      "bad-provides.md",
      `---
skill: bad-provides
description: "Card with unknown capability."
${VALID_TAGS_AND_TIERS}
provides: [non-existent-capability]
---

# Bad Provides
`
    );
  }
);

Given<TaGenWorld>(
  "a card with a core.files entry that does not exist on disk",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();
    await writeCard(
      world.projectDir,
      "missing-core-file.md",
      `---
skill: missing-core-file
description: "Card with missing core.files path."
tags:
  phase: [review]
  domain: [code-review]
  language: agnostic
  layer: methodology
  concerns: []
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
  refs: []
  slots: {}
  validators: []
---

# Missing Core File
`
    );
  }
);

Given<TaGenWorld>(
  "a protocol directory without schema.json",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();
    const protoDir = join(
      world.projectDir,
      "skill-graph",
      "protocols",
      "no-schema-protocol"
    );
    await mkdir(protoDir, { recursive: true });
    await writeFile(
      join(protoDir, "protocol.md"),
      "# Protocol: no-schema-protocol\nMissing schema.json intentionally.\n",
      "utf-8"
    );
  }
);

Given<TaGenWorld>(
  "a subagent whose frontmatter name differs from its filename",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();
    const dir = join(world.projectDir, "skill-graph", "subagents");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "mismatched-stem.md"),
      `---
name: different-from-filename
model: haiku
description: "Subagent with mismatched name."
consumes: []
emits: []
references: []
---

# Mismatched
`,
      "utf-8"
    );
  }
);

Given<TaGenWorld>(
  "a subagent with an unknown model value",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();
    const dir = join(world.projectDir, "skill-graph", "subagents");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "unknown-model.md"),
      `---
name: unknown-model
model: gpt4
description: "Subagent with unknown model."
consumes: []
emits: []
references: []
---

# Unknown Model
`,
      "utf-8"
    );
  }
);

Given<TaGenWorld>(
  "a card whose frontmatter omits description",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();
    await writeCard(
      world.projectDir,
      "no-description.md",
      `---
skill: no-description
${VALID_TAGS_AND_TIERS}
---

# No Description
`
    );
  }
);

Given<TaGenWorld>(
  "a card whose frontmatter contains 'composes'",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();
    await writeCard(
      world.projectDir,
      "with-composes.md",
      `---
skill: with-composes
description: "Card with legacy composes field."
composes: [other-card]
${VALID_TAGS_AND_TIERS}
---

# With Composes
`
    );
  }
);

Given<TaGenWorld>(
  "a card whose frontmatter contains 'source'",
  async (world: TaGenWorld) => {
    world.projectDir = await createProjectDir();
    await writeCard(
      world.projectDir,
      "with-source.md",
      `---
skill: with-source
description: "Card with legacy source field."
source: plugins/foo/skills/bar/SKILL.md
${VALID_TAGS_AND_TIERS}
---

# With Source
`
    );
  }
);

// ─── When ─────────────────────────────────────────────────────────────────────

When<TaGenWorld>('I run "tagen validate"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["validate"], world.projectDir);
});

// ─── Then ─────────────────────────────────────────────────────────────────────

Then<TaGenWorld>("it exits 0", (world: TaGenWorld) => {
  expect(world.result?.exitCode).toBe(0);
});

Then<TaGenWorld>("it exits non-zero", (world: TaGenWorld) => {
  expect(world.result?.exitCode).not.toBe(0);
});

Then<TaGenWorld>('it prints "All N cards valid"', (world: TaGenWorld) => {
  const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
  expect(combined).toMatch(/All \d+ card/i);
  expect(combined).toContain("valid");
});

// One Then per error phrase — matches the wording used in feature scenarios.
const ERROR_PHRASES = [
  "unknown phase value",
  "unknown language value",
  "unknown capability in provides",
  "path not found",
  "missing schema.json",
  "does not match filename",
  "unknown model",
  "missing required field: description",
  "legacy field 'composes'",
  "legacy field 'source'",
];

for (const phrase of ERROR_PHRASES) {
  Then<TaGenWorld>(`it prints an error containing "${phrase}"`, (world: TaGenWorld) => {
    const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
    expect(combined).toContain(phrase);
  });
}
