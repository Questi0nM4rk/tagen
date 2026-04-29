import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv/dist/2020";
import { filterCards, loadAllCards } from "../src/lib/catalog.ts";
import type { Manifest } from "../src/lib/compose.ts";
import { buildManifest, compose } from "../src/lib/compose.ts";
import { loadProtocols } from "../src/lib/protocols.ts";
import { loadSubagents } from "../src/lib/subagents.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph-v2");
const SCHEMA_PATH = join(import.meta.dir, "../docs/tagen-get-manifest.schema.json");

let manifest: Manifest;
let ajv: Ajv;
let schema: Record<string, unknown>;

beforeAll(() => {
  const cards = loadAllCards(FIXTURES);
  const subagents = loadSubagents(FIXTURES);
  const protocols = loadProtocols(FIXTURES);

  // Compose using the v2 fixture cards (domain=code-review matches both
  // v2-strict-review and v2-csharp-patterns). repoRoot=FIXTURES makes all
  // paths fixture-relative, which is deterministic across machines.
  const v2Cards = filterCards(cards, { domain: ["code-review"] });
  const comp = compose(v2Cards, subagents, { domain: "code-review" });
  manifest = buildManifest(comp, subagents, protocols, FIXTURES);

  schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as Record<string, unknown>;
  ajv = new Ajv({ strict: false });
});

// ─── positive: valid manifest ─────────────────────────────────────────────────

describe("manifest contract — positive", () => {
  test("manifest includes both v2 fixture modules", () => {
    expect(manifest.modules).toContain("v2-strict-review");
    expect(manifest.modules).toContain("v2-csharp-patterns");
  });

  test("manifest validates against tagen-get-manifest.schema.json", () => {
    const valid = ajv.validate(schema, manifest);
    expect(valid).toBe(true);
    expect(ajv.errors).toBeNull();
  });

  test("top-level required keys are all present", () => {
    const keys = [
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
    for (const key of keys) {
      expect(manifest).toHaveProperty(key);
    }
  });

  test("validators object has protocol and card arrays", () => {
    expect(Array.isArray(manifest.validators.protocol)).toBe(true);
    expect(Array.isArray(manifest.validators.card)).toBe(true);
  });

  test("language-patterns slot is resolved by v2-csharp-patterns", () => {
    const slot = manifest.slots.find((s) => s.capability === "language-patterns");
    expect(slot).toBeDefined();
    expect(slot?.fillerCard).toBe("v2-csharp-patterns");
    expect(slot?.candidates).toContain("v2-csharp-patterns");
  });

  test("v2-domain-reviewer subagent is resolved with correct model", () => {
    const sub = manifest.subagents.find((s) => s.name === "v2-domain-reviewer");
    expect(sub).toBeDefined();
    expect(sub?.model).toBe("sonnet");
  });

  test("ResolvedSubagent has all required fields", () => {
    const sub = manifest.subagents.find((s) => s.name === "v2-domain-reviewer");
    expect(typeof sub?.name).toBe("string");
    expect(typeof sub?.model).toBe("string");
    expect(typeof sub?.prompt).toBe("string");
    expect(typeof sub?.description).toBe("string");
    expect(Array.isArray(sub?.consumes)).toBe(true);
    expect(Array.isArray(sub?.emits)).toBe(true);
    expect(Array.isArray(sub?.references)).toBe(true);
  });

  test("finding protocol validator is included (v2-strict-review consumes finding)", () => {
    const pv = manifest.validators.protocol.find((v) => v.protocol === "finding");
    expect(pv).toBeDefined();
    expect(pv?.path).toMatch(/protocols\/finding\/validator\.ts$/);
  });

  test("card validator is included for v2-strict-review", () => {
    const cv = manifest.validators.card.find((v) => v.module === "v2-strict-review");
    expect(cv).toBeDefined();
    expect(cv?.path).toMatch(/validators\/no-emoji\.ts$/);
  });

  test("emits and consumes are string arrays", () => {
    expect(manifest.emits.every((e) => typeof e === "string")).toBe(true);
    expect(manifest.consumes.every((c) => typeof c === "string")).toBe(true);
  });

  test("warnings is a string array", () => {
    expect(Array.isArray(manifest.warnings)).toBe(true);
    expect(manifest.warnings.every((w) => typeof w === "string")).toBe(true);
  });
});

// ─── negative: schema rejects mutated manifests ───────────────────────────────

describe("manifest contract — negative", () => {
  test("missing top-level 'modules' fails validation", () => {
    const mutated: Record<string, unknown> = { ...manifest };
    delete mutated.modules;
    const valid = ajv.validate(schema, mutated);
    expect(valid).toBe(false);
    expect(ajv.errors).not.toBeNull();
  });

  test("missing top-level 'validators' fails validation", () => {
    const mutated: Record<string, unknown> = { ...manifest };
    delete mutated.validators;
    const valid = ajv.validate(schema, mutated);
    expect(valid).toBe(false);
  });

  test("missing top-level 'slots' fails validation", () => {
    const mutated: Record<string, unknown> = { ...manifest };
    delete mutated.slots;
    const valid = ajv.validate(schema, mutated);
    expect(valid).toBe(false);
  });

  test("unknown top-level property fails validation (additionalProperties: false)", () => {
    const mutated = { ...manifest, _extra: "injected" } as Record<string, unknown>;
    const valid = ajv.validate(schema, mutated);
    expect(valid).toBe(false);
  });

  test("subagent with invalid model enum fails validation", () => {
    const badSub = {
      name: "bad-agent",
      model: "gpt-4",
      prompt: "skill-graph/subagents/bad-agent.md",
      description: "bad",
      consumes: [],
      emits: [],
      references: [],
    };
    const mutated = { ...manifest, subagents: [badSub] };
    const valid = ajv.validate(schema, mutated);
    expect(valid).toBe(false);
  });

  test("ref with non-null, non-string slot fails validation", () => {
    const badRef = { path: "brain/x/refs/y.md", slot: 42 };
    const mutated = { ...manifest, refs: [badRef] };
    const valid = ajv.validate(schema, mutated);
    expect(valid).toBe(false);
  });

  test("slot with empty candidates array fails validation (minItems: 1)", () => {
    const badSlot = {
      capability: "language-patterns",
      fillerCard: "v2-csharp-patterns",
      candidates: [],
    };
    const mutated = { ...manifest, slots: [badSlot] };
    const valid = ajv.validate(schema, mutated);
    expect(valid).toBe(false);
  });
});
