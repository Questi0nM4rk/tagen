import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";

const ROOT = join(import.meta.dir, "..");
const SCHEMA = JSON.parse(
  readFileSync(join(ROOT, "docs", "tagen-get-manifest.schema.json"), "utf8")
) as object;
const FIXTURES = join(ROOT, "__tests__", "fixtures");
const ENTRY = join(ROOT, "src", "main.ts");

async function runGetJson(args: string[]): Promise<unknown> {
  const proc = Bun.spawn(["bun", "run", ENTRY, "get", ...args, "--json"], {
    cwd: FIXTURES,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  const [exitCode, stdout] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
  ]);
  if (exitCode !== 0)
    throw new Error(`tagen get exited ${exitCode}\nstdout:\n${stdout}`);
  return JSON.parse(stdout);
}

describe("manifest contract", () => {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(SCHEMA);

  test("`tagen get strict csharp --json` matches the schema", async () => {
    const manifest = await runGetJson(["strict", "csharp"]);
    if (!validate(manifest)) {
      const detail = (validate.errors ?? [])
        .map((e) => `${e.instancePath || "/"} ${e.message}`)
        .join("\n");
      throw new Error(
        `schema violations:\n${detail}\n\nmanifest:\n${JSON.stringify(manifest, null, 2)}`
      );
    }
    expect(validate(manifest)).toBe(true);
  });

  test("manifest with unfilled-slot warning still matches schema", async () => {
    const manifest = await runGetJson(["strict"]);
    expect(validate(manifest)).toBe(true);
  });

  test("manifest for single non-methodology card matches schema", async () => {
    const manifest = await runGetJson(["python"]);
    expect(validate(manifest)).toBe(true);
  });
});
