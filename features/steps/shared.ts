/**
 * Shared world type and helpers for tagen BDD steps.
 *
 * Every scenario runs `tagen` as a subprocess against either the canonical
 * fixture brain (`__tests__/fixtures/`) or a temp clone of it.
 */

import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CLIResult, World } from "@questi0nm4rk/feats";

export interface TaGenWorld extends World {
  /** Working directory for the next runTagen invocation. */
  cwd: string;
  /** Result of the last CLI invocation. */
  result?: CLIResult;
  /** Cleanup callback set by "temporary brain" Givens; run in the After hook. */
  cleanup?: () => void;
}

const ROOT = join(import.meta.dir, "..", "..");
export const FIXTURES_DIR = join(ROOT, "__tests__", "fixtures");
export const TAGEN_ENTRY = join(ROOT, "src", "main.ts");

/** Spawn tagen with the given args. cwd defaults to the canonical fixture dir. */
export async function runTagen(args: string[], cwd: string): Promise<CLIResult> {
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
  return { exitCode: exitCode ?? 1, stdout, stderr, timedOut: false };
}

/** Create a temp dir holding a copy of the canonical fixture brain. */
export function cloneFixtureBrain(): { brainParent: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "tagen-bdd-"));
  cpSync(join(FIXTURES_DIR, "brain"), join(dir, "brain"), { recursive: true });
  return {
    brainParent: dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
