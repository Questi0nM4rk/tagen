import { expect } from "bun:test";
import { After, Before, Given, Then, When } from "@questi0nm4rk/feats";
import {
  cloneFixtureBrain,
  FIXTURES_DIR,
  runTagen,
  type TaGenWorld,
} from "./shared.ts";

Before(async (world: TaGenWorld) => {
  world.cwd = FIXTURES_DIR;
  world.result = undefined;
  world.cleanup = undefined;
});

After(async (world: TaGenWorld) => {
  if (world.cleanup) {
    const fn = world.cleanup;
    world.cleanup = undefined;
    fn();
  }
});

// ─── Given ───────────────────────────────────────────────────────────────────

Given<TaGenWorld>("the canonical fixture brain", (world: TaGenWorld) => {
  world.cwd = FIXTURES_DIR;
});

Given<TaGenWorld>(
  "a temporary brain dir copied from the canonical fixture",
  (world: TaGenWorld) => {
    const { brainParent, cleanup } = cloneFixtureBrain();
    world.cwd = brainParent;
    world.cleanup = cleanup;
  }
);

// ─── When ─────────────────────────────────────────────────────────────────────

When<TaGenWorld>(
  "I run tagen with args {}",
  async (world: TaGenWorld, rawArgs: unknown) => {
    const args = String(rawArgs).split(/\s+/).filter(Boolean);
    world.result = await runTagen(args, world.cwd);
  }
);

// ─── Then — exit codes ───────────────────────────────────────────────────────

Then<TaGenWorld>("it exits {int}", (world: TaGenWorld, code: unknown) => {
  expect(world.result?.exitCode).toBe(Number(code));
});

// ─── Then — stdout/stderr text matchers ──────────────────────────────────────

Then<TaGenWorld>("stdout contains {string}", (world: TaGenWorld, needle: unknown) => {
  expect(world.result?.stdout ?? "").toContain(String(needle));
});

Then<TaGenWorld>("stderr contains {string}", (world: TaGenWorld, needle: unknown) => {
  expect(world.result?.stderr ?? "").toContain(String(needle));
});

Then<TaGenWorld>("stderr is empty", (world: TaGenWorld) => {
  expect(world.result?.stderr ?? "").toBe("");
});

Then<TaGenWorld>(
  "stdout contains exactly the lines {}",
  (world: TaGenWorld, csv: unknown) => {
    const expected = String(csv).split(",");
    const actual = (world.result?.stdout ?? "").trim().split("\n").sort();
    expect(actual).toEqual(expected.sort());
  }
);

// ─── Then — JSON shape ───────────────────────────────────────────────────────

Then<TaGenWorld>("stdout is valid JSON", (world: TaGenWorld) => {
  expect(() => JSON.parse(world.result?.stdout ?? "")).not.toThrow();
});

Then<TaGenWorld>(
  "the JSON array contains an entry with type lang and name csharp",
  (world: TaGenWorld) => {
    const parsed = JSON.parse(world.result?.stdout ?? "[]") as Array<{
      type: string;
      name: string;
    }>;
    expect(parsed.find((e) => e.type === "lang" && e.name === "csharp")).toBeDefined();
  }
);

// ─── Then — manifest assertions ──────────────────────────────────────────────

const REQUIRED_MANIFEST_KEYS = [
  "root",
  "modules",
  "core",
  "references",
  "filled",
  "slots",
  "subagents",
  "validators",
  "warnings",
] as const;

Then<TaGenWorld>("the manifest has every required field", (world: TaGenWorld) => {
  const m = JSON.parse(world.result?.stdout ?? "{}") as Record<string, unknown>;
  for (const k of REQUIRED_MANIFEST_KEYS) expect(m).toHaveProperty(k);
});

Then<TaGenWorld>(
  "manifest.modules contains a card {word}\\/{word}",
  (world: TaGenWorld, type: unknown, name: unknown) => {
    const m = JSON.parse(world.result?.stdout ?? "{}") as {
      modules: Array<{ type: string; name: string }>;
    };
    expect(
      m.modules.find((mod) => mod.type === type && mod.name === name)
    ).toBeDefined();
  }
);

Then<TaGenWorld>(
  "the {word} slot is filled by {word}",
  (world: TaGenWorld, slotType: unknown, fillerName: unknown) => {
    const m = JSON.parse(world.result?.stdout ?? "{}") as {
      slots: Array<{ type: string; fillerCard: string }>;
    };
    const slot = m.slots.find((s) => s.type === slotType);
    expect(slot?.fillerCard).toBe(String(fillerName));
  }
);

// ─── Then — filesystem assertions ────────────────────────────────────────────
