import { expect } from "bun:test";
import { rm } from "node:fs/promises";
import { After, Before, Then, When } from "@questi0nm4rk/feats";
import type { TaGenWorld } from "./shared.ts";
import { runTagen } from "./shared.ts";

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
// Reuse "a skill-graph with v2 cards that satisfy all requires" and
// "a skill-graph with a card whose requires are not satisfied" from demo.steps.ts,
// and "a skill-graph with catalog cards" from list.steps.ts.
// @questi0nm4rk/feats shares step registrations globally within the runner.

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
  'I run "tagen get --card v2-strict-review --card v2-csharp-patterns --json"',
  async (world: TaGenWorld) => {
    if (!world.projectDir) throw new Error("projectDir not set");
    world.result = await runTagen(
      ["get", "--card", "v2-strict-review", "--card", "v2-csharp-patterns", "--json"],
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
    expect(modules).toContain("v2-strict-review");
    expect(modules).toContain("v2-csharp-patterns");
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
