/**
 * Shared test helpers for tagen unit tests.
 * Lightweight subprocess runner + temp project factory.
 */

import { cpSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CatalogCard } from "../src/lib/types";

// ─── Fixture paths ──────────────────────────────────────────────────────────

export const FIXTURES = join(import.meta.dir, "fixtures");
export const SKILL_GRAPH_FIXTURES = join(FIXTURES, "skill-graph");
export const PLUGIN_FIXTURES = join(FIXTURES, "plugins");

/** Path to the tagen entry point (run via bun) */
const TAGEN_ENTRY = join(import.meta.dir, "..", "src", "main.ts");

// ─── Subprocess runner ──────────────────────────────────────────────────────

export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Run tagen via bun with the given args in the specified directory.
 * Spawns a real subprocess — safe against process.exit() in commands.
 */
export async function spawnTagen(args: string[], cwd: string): Promise<SpawnResult> {
  const proc = Bun.spawn(["bun", "run", TAGEN_ENTRY, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  return { exitCode: exitCode ?? 1, stdout, stderr };
}

// ─── Temp project factory ───────────────────────────────────────────────────

/**
 * Create a temporary project directory pre-populated with skill-graph fixtures.
 * Returns the temp dir path — caller must clean up.
 */
export function createTempProject(opts?: { plugins?: string[] }): string {
  const dir = mkdtempSync(join(tmpdir(), "tagen-test-"));

  // Copy skill-graph (vocabulary + skills)
  cpSync(SKILL_GRAPH_FIXTURES, join(dir, "skill-graph"), { recursive: true });

  // Copy requested plugin build.yamls
  if (opts?.plugins && opts.plugins.length > 0) {
    for (const pluginName of opts.plugins) {
      const src = join(PLUGIN_FIXTURES, pluginName);
      const dst = join(dir, "plugins", pluginName);
      mkdirSync(dst, { recursive: true });
      cpSync(src, dst, { recursive: true });
    }
  }

  // Ensure .claude-plugin dir exists for marketplace.json
  mkdirSync(join(dir, ".claude-plugin"), { recursive: true });

  return dir;
}

// ─── Test data factories ────────────────────────────────────────────────────

/** Create a CatalogCard with sensible defaults, overridable per field. */
export function makeCard(overrides?: Partial<CatalogCard>): CatalogCard {
  return {
    skill: "test-skill",
    plugin: "test-plugin",
    source: "plugins/test-plugin/skills/test-skill/SKILL.md",
    tags: {
      phase: ["implementation"],
      domain: ["testing"],
      language: "agnostic",
      layer: "methodology",
      concerns: ["testing"],
    },
    composes: [],
    enhances: [],
    description: "A test skill.",
    ironLaws: ["Law one — WHY: reason one", "Law two — WHY: reason two"],
    body: "# Test Skill\n\nBody content here.",
    filePath: "/tmp/test-skill.md",
    ...overrides,
  };
}
