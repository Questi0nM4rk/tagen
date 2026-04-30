import { expect } from "bun:test";
import { Then, When } from "@questi0nm4rk/feats";
import type { TaGenWorld } from "./shared.ts";
import { runTagen } from "./shared.ts";

When<TaGenWorld>('I run "tagen tags"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["tags"], world.projectDir);
});

When<TaGenWorld>('I run "tagen tags --json"', async (world: TaGenWorld) => {
  if (!world.projectDir) throw new Error("projectDir not set");
  world.result = await runTagen(["tags", "--json"], world.projectDir);
});

Then<TaGenWorld>("it prints the phase dimension", (world: TaGenWorld) => {
  expect(world.result?.stdout ?? "").toContain("phase —");
});

Then<TaGenWorld>("it prints the capabilities section", (world: TaGenWorld) => {
  expect(world.result?.stdout ?? "").toContain("\ncapabilities\n");
});

Then<TaGenWorld>("it prints the protocols section", (world: TaGenWorld) => {
  expect(world.result?.stdout ?? "").toContain("\nprotocols\n");
});

Then<TaGenWorld>("it prints the subagents section", (world: TaGenWorld) => {
  expect(world.result?.stdout ?? "").toContain("\nsubagents\n");
});

Then<TaGenWorld>(
  "the JSON has top-level keys tags, capabilities, protocols, subagents",
  (world: TaGenWorld) => {
    const parsed = JSON.parse(world.result?.stdout ?? "{}") as Record<string, unknown>;
    expect(parsed).toHaveProperty("tags");
    expect(parsed).toHaveProperty("capabilities");
    expect(parsed).toHaveProperty("protocols");
    expect(parsed).toHaveProperty("subagents");
  }
);
