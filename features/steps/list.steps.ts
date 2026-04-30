import { expect } from "bun:test";
import { Then, When } from "@questi0nm4rk/feats";
import type { TaGenWorld } from "./shared.ts";
import { runTagen } from "./shared.ts";

// Lifecycle hooks live in common.steps.ts.

// ─── When ─────────────────────────────────────────────────────────────────────

When<TaGenWorld>('I run "tagen list"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["list"], world.projectDir);
});

When<TaGenWorld>('I run "tagen list --language dotnet"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["list", "--language", "dotnet"], world.projectDir);
});

When<TaGenWorld>(
  'I run "tagen list --domain code-review"',
  async (world: TaGenWorld) => {
    if (!world.projectDir) throw new Error("projectDir not set");
    world.result = await runTagen(
      ["list", "--domain", "code-review"],
      world.projectDir
    );
  }
);

When<TaGenWorld>('I run "tagen list --subagents"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["list", "--subagents"], world.projectDir);
});

When<TaGenWorld>('I run "tagen list --json"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["list", "--json"], world.projectDir);
});

// ─── Then ─────────────────────────────────────────────────────────────────────

Then<TaGenWorld>("it prints both fixture skill names", (world: TaGenWorld) => {
  const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
  expect(combined).toContain("strict-review");
  expect(combined).toContain("csharp-patterns");
});

Then<TaGenWorld>("it shows dotnet and agnostic skills", (world: TaGenWorld) => {
  const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
  expect(combined).toContain("csharp-patterns"); // dotnet
  expect(combined).toContain("strict-review"); // agnostic — included
});

Then<TaGenWorld>("it prints the domain-reviewer subagent", (world: TaGenWorld) => {
  const combined = (world.result?.stdout ?? "") + (world.result?.stderr ?? "");
  expect(combined).toContain("domain-reviewer");
});

Then<TaGenWorld>("it contains an array of skill objects", (world: TaGenWorld) => {
  const parsed = JSON.parse(world.result?.stdout ?? "[]") as unknown[];
  expect(Array.isArray(parsed)).toBe(true);
  expect(parsed.length).toBeGreaterThan(0);
  const first = parsed[0] as { skill?: string };
  expect(typeof first.skill).toBe("string");
});
