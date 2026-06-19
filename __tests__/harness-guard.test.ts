import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findHarnessLeaks } from "../src/lib/harness-guard.ts";

describe("harness guard", () => {
  test("scans governed extensions and avoids ordinary words", () => {
    const root = mkdtempSync(join(tmpdir(), "tagen-guard-"));
    try {
      const brain = join(root, "brain");
      const card = join(brain, "methodology", "portable");
      mkdirSync(join(card, "references"), { recursive: true });
      mkdirSync(join(brain, "protocol", "wire"), { recursive: true });
      writeFileSync(
        join(card, "CORE.md"),
        `---\ndescription: "Portable orchestration"\n---\nUse a worker.\n`
      );
      writeFileSync(
        join(card, "references", "details.md"),
        "Do not name the Task tool or PreToolUse.\n"
      );
      writeFileSync(
        join(brain, "protocol", "wire", "schema.json"),
        JSON.stringify({ description: "Claude Code payload" })
      );
      writeFileSync(
        join(brain, "protocol", "wire", "validator.ts"),
        "// claude-sonnet-4-6\n"
      );

      const leaks = findHarnessLeaks(brain, root, {
        additionalTerms: [],
        allow: [],
      });
      expect(leaks.some((leak) => leak.ruleId === "claude-tool-language")).toBe(true);
      expect(leaks.some((leak) => leak.ruleId === "claude-hook-event")).toBe(true);
      expect(leaks.some((leak) => leak.ruleId === "harness-name")).toBe(true);
      expect(leaks.some((leak) => leak.ruleId === "vendor-model-id")).toBe(true);
      expect(leaks.some((leak) => leak.path.endsWith("CORE.md"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
