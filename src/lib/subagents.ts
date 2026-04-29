import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Subagent } from "./types";

/**
 * Load all subagents from skill-graph/subagents/<name>.md.
 *
 * Each subagent is a markdown file with YAML frontmatter:
 *
 *   ---
 *   name: security-reviewer
 *   model: sonnet
 *   description: "…"
 *   consumes: [recon-summary]
 *   emits: [finding]
 *   references: [language-patterns]
 *   ---
 *
 *   # Security Reviewer
 *   …
 */
export function loadSubagents(vaultDir: string): Subagent[] {
  const dir = join(vaultDir, "subagents");
  if (!existsSync(dir)) return [];

  const subagents: Subagent[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const filePath = join(dir, file);
    const parsed = parseSubagent(filePath);
    if (parsed) subagents.push(parsed);
  }

  return subagents.sort((a, b) => a.name.localeCompare(b.name));
}

function parseSubagent(filePath: string): Subagent | null {
  const raw = readFileSync(filePath, "utf8");
  const parts = raw.split("---");
  if (parts.length < 3) return null;

  const yaml = parseYaml(parts[1]) as Record<string, unknown> | null;
  if (!yaml || typeof yaml !== "object") return null;
  if (!yaml.name) return null;

  const body = parts.slice(2).join("---").trim();

  // Tolerant load: take whatever model string is in the file. The Subagent type
  // narrows to SubagentModel at the type layer; runtime validation that the
  // value is actually one of haiku/sonnet/opus is `runValidate`'s job, not the
  // loader's. Skipping bad-model entries here would hide them from validate's
  // error reporting (see SPEC-004 edge case matrix).
  return {
    name: String(yaml.name),
    model: String(yaml.model ?? "") as Subagent["model"],
    description: String(yaml.description ?? ""),
    consumes: toStringArray(yaml.consumes),
    emits: toStringArray(yaml.emits),
    references: toStringArray(yaml.references),
    body,
    filePath,
  };
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

/** Extract the filename stem (for "name matches filename" validation). */
export function filenameStem(filePath: string): string {
  return basename(filePath, ".md");
}
