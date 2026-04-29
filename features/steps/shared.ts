/**
 * Shared world type and helpers for tagen BDD steps.
 */

import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

/** Path to the compiled tagen entry point (run via bun) */
export const TAGEN_ENTRY = join(import.meta.dir, "..", "..", "src", "main.ts");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a temporary project directory pre-populated with a skill-graph and
 * its sibling brain/ tree so that findVaultDir() resolves correctly and the
 * core.files / deep.refs / deep.validators paths in fixture cards exist.
 */
export async function createProjectDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tagen-bdd-"));
  await cp(SKILL_GRAPH_FIXTURES, join(dir, "skill-graph"), { recursive: true });
  const brainSrc = join(FIXTURES_DIR, "brain");
  await cp(brainSrc, join(dir, "brain"), { recursive: true });
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

// ─── Card / fixture helpers shared across step files ─────────────────────────

/**
 * Tag block + tier scaffolding without `provides`/`requires`/`emits`/`consumes`,
 * so callers can append the v2 service-contract fields without colliding on
 * YAML keys. Keep multi-line — the indentation is significant.
 */
export const VALID_TAGS_AND_TIERS = `tags:
  phase: [review]
  domain: [code-review]
  language: agnostic
  layer: methodology
  concerns: [review-automation]
surface:
  triggers: []
core:
  files: []
deep:
  subagents: []
  refs: []
  slots: {}
  validators: []`;

/** Write a catalog card .md to <projectDir>/skill-graph/skills/<filename>. */
export async function writeCard(
  projectDir: string,
  filename: string,
  body: string
): Promise<void> {
  await writeFile(join(projectDir, "skill-graph", "skills", filename), body, "utf-8");
}

/** Wipe and recreate the project's skills/ dir — used when a scenario needs a
 * pristine catalog (e.g. unmet-requires tests can't tolerate fixture cards). */
export async function resetSkills(projectDir: string): Promise<void> {
  const dir = join(projectDir, "skill-graph", "skills");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}
