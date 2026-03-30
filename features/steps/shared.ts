/**
 * Shared world type and helpers for tagen BDD steps.
 */

import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CLIResult, World } from "@questi0nm4rk/feats";

// ─── World ────────────────────────────────────────────────────────────────────

export interface TaGenWorld extends World {
  /** Temporary directory acting as the fake marketplace root */
  projectDir?: string;
  /** Result of the last CLI invocation */
  result?: CLIResult;
  /** Extra context flags for step coordination */
  flags?: Record<string, boolean>;
}

// ─── Fixture paths ────────────────────────────────────────────────────────────

export const FIXTURES_DIR = join(import.meta.dir, "..", "..", "__tests__", "fixtures");
export const SKILL_GRAPH_FIXTURES = join(FIXTURES_DIR, "skill-graph");
export const PLUGIN_FIXTURES = join(FIXTURES_DIR, "plugins");

/** Path to the compiled tagen entry point (run via bun) */
export const TAGEN_ENTRY = join(import.meta.dir, "..", "..", "src", "main.ts");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a temporary project directory pre-populated with a skill-graph
 * so that findVaultDir() resolves correctly.
 */
export async function createProjectDir(opts?: {
  extraSkills?: string[];
  plugins?: string[];
}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tagen-bdd-"));

  // Copy skill-graph (vocabulary + skills)
  await cp(SKILL_GRAPH_FIXTURES, join(dir, "skill-graph"), { recursive: true });

  // Remove skills not requested (default: copy all fixture skills)
  if (opts?.extraSkills !== undefined) {
    // extraSkills === [] means only extra skills — start fresh and copy only those
  }

  // Create plugins directory and copy requested plugin build.yamls
  if (opts?.plugins && opts.plugins.length > 0) {
    for (const pluginName of opts.plugins) {
      const srcPlugin = join(PLUGIN_FIXTURES, pluginName);
      const dstPlugin = join(dir, "plugins", pluginName);
      await mkdir(dstPlugin, { recursive: true });
      await cp(srcPlugin, dstPlugin, { recursive: true });
    }
  }

  // Ensure .claude-plugin dir exists for marketplace.json
  await mkdir(join(dir, ".claude-plugin"), { recursive: true });

  return dir;
}

/**
 * Run tagen via bun with the given args in the project directory.
 * Uses bun to execute the source directly so no compile step is needed.
 */
export async function runTagen(args: string[], projectDir: string): Promise<CLIResult> {
  const proc = Bun.spawn(["bun", "run", TAGEN_ENTRY, ...args], {
    cwd: projectDir,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  return {
    exitCode: exitCode ?? 1,
    stdout,
    stderr,
    timedOut: false,
  };
}

/**
 * Write a minimal catalog card .md file to the project's skill-graph/skills/.
 */
export async function writeSkillCard(
  projectDir: string,
  skillName: string,
  overrides: Partial<{
    plugin: string;
    language: string;
    phase: string[];
    domain: string[];
    layer: string;
    concerns: string[];
  }>
): Promise<void> {
  const skillsDir = join(projectDir, "skill-graph", "skills");
  const language = overrides.language ?? "agnostic";
  const phase = overrides.phase ?? ["implementation"];
  const domain = overrides.domain ?? ["testing"];
  const layer = overrides.layer ?? "standards";
  const concerns = overrides.concerns ?? ["testing"];
  const plugin = overrides.plugin ?? "qsm-test";

  const content = `---
skill: ${skillName}
plugin: ${plugin}
source: plugins/${plugin}/skills/${skillName}/SKILL.md
description: "Auto-generated test skill."
tags:
  phase: [${phase.join(", ")}]
  domain: [${domain.join(", ")}]
  language: ${language}
  layer: ${layer}
  concerns: [${concerns.join(", ")}]
iron_laws:
  - "One iron law — WHY: testing"
composes: []
enhances: []
---

# ${skillName}

Auto-generated test skill body.
`;

  await writeFile(join(skillsDir, `${skillName}.md`), content, "utf-8");
}
