import { expect } from "bun:test";
import { rm } from "node:fs/promises";
import { After, Before, Given, Then } from "@questi0nm4rk/feats";
import type { TaGenWorld } from "./shared.ts";
import { createProjectDir } from "./shared.ts";

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

// ─── Given (shared across features) ───────────────────────────────────────────

Given<TaGenWorld>("a skill-graph with catalog cards", async (world: TaGenWorld) => {
  world.projectDir = await createProjectDir();
});

// ─── Then (shared across features) ────────────────────────────────────────────

Then<TaGenWorld>("stdout is valid JSON", (world: TaGenWorld) => {
  expect(() => JSON.parse(world.result?.stdout ?? "")).not.toThrow();
});
