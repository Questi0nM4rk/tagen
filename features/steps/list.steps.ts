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

Given<TaGenWorld>("a skill-graph with 3 skills", async (world: TaGenWorld) => {
  // The default fixture has exactly 3 skills: tdd-workflow, ts-tdd, python-bdd
  world.projectDir = await createProjectDir();
});

Given<TaGenWorld>("skills in typescript and python", async (world: TaGenWorld) => {
  world.projectDir = await createProjectDir();
});

// ─── When ─────────────────────────────────────────────────────────────────────

When<TaGenWorld>('I run "tagen list"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["list"], world.projectDir);
});

When<TaGenWorld>(
  'I run "tagen list --filter language=typescript"',
  async (world: TaGenWorld) => {
    if (!world.projectDir) throw new Error("projectDir not set");
    world.result = await runTagen(
      ["list", "--filter", "language=typescript"],
      world.projectDir
    );
  }
);

When<TaGenWorld>('I run "tagen list --json"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["list", "--json"], world.projectDir);
});

// ─── Then ─────────────────────────────────────────────────────────────────────

Then<TaGenWorld>("it prints all 3 skill names", (world: TaGenWorld) => {
  const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
  expect(combined).toContain("tdd-workflow");
  expect(combined).toContain("ts-tdd");
  expect(combined).toContain("python-bdd");
});

Then<TaGenWorld>("it shows only typescript skills", (world: TaGenWorld) => {
  const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
  // filterCards with language=typescript includes typescript AND agnostic
  expect(combined).toContain("ts-tdd");
  expect(combined).toContain("tdd-workflow"); // agnostic included
  expect(combined).not.toContain("python-bdd");
});

Then<TaGenWorld>("it contains an array of skill objects", (world: TaGenWorld) => {
  const parsed = JSON.parse(world.result?.stdout ?? "[]") as unknown[];
  expect(Array.isArray(parsed)).toBe(true);
  expect(parsed.length).toBeGreaterThan(0);

  // Each item should have a skill field
  const first = parsed[0] as { skill?: string };
  expect(typeof first.skill).toBe("string");
});
