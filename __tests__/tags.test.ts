import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import type { SpawnResult } from "./helpers";
import { createTempProject, spawnTagen } from "./helpers";

let projectDir: string;
let textResult: SpawnResult;
let jsonResult: SpawnResult;

beforeAll(async () => {
  projectDir = createTempProject();
  [textResult, jsonResult] = await Promise.all([
    spawnTagen(["tags"], projectDir),
    spawnTagen(["tags", "--json"], projectDir),
  ]);
});

afterAll(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

// ─── tagen tags (text mode) ─────────────────────────────────────────────────

describe("tagen tags", () => {
  test("exits 0", () => {
    expect(textResult.exitCode).toBe(0);
  });

  test("outputs all 5 dimension names", () => {
    for (const dim of ["phase", "domain", "language", "layer", "concerns"]) {
      expect(textResult.stdout).toContain(dim);
    }
  });

  test("outputs dimension descriptions", () => {
    expect(textResult.stdout).toContain("Where in the software development lifecycle");
    expect(textResult.stdout).toContain("Language or runtime specificity");
  });

  test("outputs phase order arrow notation", () => {
    expect(textResult.stdout).toContain("→");
    expect(textResult.stdout).toContain("planning");
    expect(textResult.stdout).toContain("operations");
  });

  test("outputs vocabulary values", () => {
    expect(textResult.stdout).toContain("agnostic");
    expect(textResult.stdout).toContain("typescript");
    expect(textResult.stdout).toContain("methodology");
  });
});

// ─── tagen tags --json ──────────────────────────────────────────────────────

describe("tagen tags --json", () => {
  test("exits 0", () => {
    expect(jsonResult.exitCode).toBe(0);
  });

  test("outputs valid JSON", () => {
    expect(() => JSON.parse(jsonResult.stdout)).not.toThrow();
  });

  test("JSON has all dimension keys", () => {
    const parsed = JSON.parse(jsonResult.stdout);
    for (const dim of ["phase", "domain", "language", "layer", "concerns"]) {
      expect(parsed).toHaveProperty(dim);
    }
  });

  test("each dimension has a values object", () => {
    const parsed = JSON.parse(jsonResult.stdout);
    for (const dim of Object.values(parsed) as Array<Record<string, unknown>>) {
      expect(dim.values).toBeDefined();
      expect(typeof dim.values).toBe("object");
    }
  });
});
