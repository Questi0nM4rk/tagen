/**
 * protocol-examples.test.ts — ajv runs every protocol's example fixtures
 * against the protocol's schema. Per SPEC-tagen "Schema validation in CI",
 * valid examples MUST validate; invalid examples MUST fail.
 *
 * Skips protocols that aren't fully populated (incomplete-protocol fixture).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import { loadProtocols } from "../src/lib/protocols.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph");

interface Example {
  protocol: string;
  schemaPath: string;
  examplePath: string;
  shouldValidate: boolean;
}

function collectExamples(vaultDir: string): Example[] {
  const out: Example[] = [];
  for (const p of loadProtocols(vaultDir)) {
    if (!p.hasSchema || (!p.hasValidExamples && !p.hasInvalidExamples)) continue;
    const schemaPath = join(p.dirPath, "schema.json");
    for (const [bucket, shouldValidate] of [
      ["valid", true] as const,
      ["invalid", false] as const,
    ]) {
      const dir = join(p.dirPath, "examples", bucket);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".json")) continue;
        out.push({
          protocol: p.name,
          schemaPath,
          examplePath: join(dir, f),
          shouldValidate,
        });
      }
    }
  }
  return out;
}

describe("protocol examples — ajv schema enforcement", () => {
  const examples = collectExamples(FIXTURES);

  test("the canonical fixture has at least one example to check", () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  for (const ex of examples) {
    const label = `${ex.protocol}/${ex.shouldValidate ? "valid" : "invalid"}/${ex.examplePath.split("/").pop()}`;
    test(`${label} — ${ex.shouldValidate ? "MUST validate" : "MUST fail"}`, () => {
      const ajv = new Ajv({ strict: false });
      const schema = JSON.parse(readFileSync(ex.schemaPath, "utf8"));
      const data = JSON.parse(readFileSync(ex.examplePath, "utf8"));
      const ok = ajv.validate(schema, data);
      expect(ok).toBe(ex.shouldValidate);
    });
  }
});
