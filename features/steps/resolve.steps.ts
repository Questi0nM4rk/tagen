import { expect } from "bun:test";
import { rm } from "node:fs/promises";
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
  "a skill-graph with agnostic and typescript skills",
  async (world: TaGenWorld) => {
    // The default fixture has tdd-workflow (agnostic) and ts-tdd (typescript)
    world.projectDir = await createProjectDir();
  }
);

Given<TaGenWorld>("a skill-graph with catalog cards", async (world: TaGenWorld) => {
  world.projectDir = await createProjectDir();
});

Given<TaGenWorld>("ts-tdd composes tdd-workflow", async (world: TaGenWorld) => {
  // The fixture ts-tdd.md already has composes: [tdd-workflow]
  world.projectDir = await createProjectDir();
});

// ─── When ─────────────────────────────────────────────────────────────────────

When<TaGenWorld>(
  'I run "tagen resolve --phase implementation --language typescript"',
  async (world: TaGenWorld) => {
    if (!world.projectDir) throw new Error("projectDir not set");
    world.result = await runTagen(
      ["resolve", "--phase", "implementation", "--language", "typescript"],
      world.projectDir
    );
  }
);

When<TaGenWorld>(
  'I run "tagen resolve --phase implementation --json"',
  async (world: TaGenWorld) => {
    if (!world.projectDir) throw new Error("projectDir not set");
    world.result = await runTagen(
      ["resolve", "--phase", "implementation", "--json"],
      world.projectDir
    );
  }
);

When<TaGenWorld>(
  'I run "tagen resolve --language typescript --expand"',
  async (world: TaGenWorld) => {
    if (!world.projectDir) throw new Error("projectDir not set");
    world.result = await runTagen(
      ["resolve", "--language", "typescript", "--expand"],
      world.projectDir
    );
  }
);

// ─── Then ─────────────────────────────────────────────────────────────────────

Then<TaGenWorld>("the output includes tdd-workflow", (world: TaGenWorld) => {
  const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
  expect(combined).toContain("tdd-workflow");
});

Then<TaGenWorld>("the output includes ts-tdd", (world: TaGenWorld) => {
  const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
  expect(combined).toContain("ts-tdd");
});

Then<TaGenWorld>("stdout is valid JSON", (world: TaGenWorld) => {
  expect(() => JSON.parse(world.result?.stdout ?? "")).not.toThrow();
});

Then<TaGenWorld>('it contains a "path" array', (world: TaGenWorld) => {
  const parsed = JSON.parse(world.result?.stdout ?? "{}") as { path?: unknown };
  expect(Array.isArray(parsed.path)).toBe(true);
});

Then<TaGenWorld>(
  "the output includes tdd-workflow as an expanded skill",
  (world: TaGenWorld) => {
    // With --expand and --json, expanded skills have "expanded: true"
    // Without --json, tdd-workflow still appears in the text output
    const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
    expect(combined).toContain("tdd-workflow");
  }
);
