import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgnosticGuardConfig } from "./agnostic-config.ts";
import { rel } from "./catalog.ts";

interface GuardRule {
  id: string;
  pattern: RegExp;
}

export interface HarnessLeak {
  path: string;
  line: number;
  ruleId: string;
  token: string;
}

const SCANNED_EXTENSIONS = new Set([".md", ".json", ".ts", ".yaml", ".yml", ".toml"]);

const BUILT_IN_RULES: readonly GuardRule[] = [
  {
    id: "vendor-model-tier",
    pattern: /\b(?:haiku|sonnet|opus)\b/giu,
  },
  {
    id: "vendor-model-id",
    pattern: /\b(?:claude|gpt|gemini)[-_](?=[a-z0-9._-]*\d)[a-z0-9][a-z0-9._-]*\b/giu,
  },
  {
    id: "harness-name",
    pattern: /\b(?:Claude Code|OpenAI Codex|Codex CLI|Gemini CLI)\b/gu,
  },
  {
    id: "claude-hook-event",
    pattern: /\b(?:PreToolUse|PostToolUse|SubagentStop|SessionStart|SessionEnd)\b/gu,
  },
  {
    id: "claude-path",
    pattern: /(?:\.claude-plugin\/|\.claude\/|CLAUDE_PLUGIN_ROOT)/gu,
  },
  {
    id: "claude-command",
    pattern: /(?:^|[\s`])\/(?:plugin|mcp)\b/gu,
  },
  {
    id: "claude-tool-language",
    pattern: /\b(?:Task|Agent|AskUserQuestion)\s+tool\b/gu,
  },
];

export const BUILT_IN_RULE_IDS: ReadonlySet<string> = new Set(
  BUILT_IN_RULES.map((rule) => rule.id)
);

export function findHarnessLeaks(
  brainDir: string,
  root: string,
  config: AgnosticGuardConfig
): HarnessLeak[] {
  const rules = [
    ...BUILT_IN_RULES,
    ...config.additionalTerms.map((term) => ({
      id: term.id,
      pattern: new RegExp(escapeRegExp(term.term), term.caseSensitive ? "gu" : "giu"),
    })),
  ];
  const leaks: HarnessLeak[] = [];

  for (const file of listTextFiles(brainDir)) {
    const relativePath = rel(file, root);
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      for (const rule of rules) {
        if (isAllowed(relativePath, rule.id, config)) continue;
        rule.pattern.lastIndex = 0;
        for (const match of line.matchAll(rule.pattern)) {
          leaks.push({
            path: relativePath,
            line: index + 1,
            ruleId: rule.id,
            token: match[0].trim(),
          });
        }
      }
    }
  }
  return leaks.sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.line - b.line ||
      a.ruleId.localeCompare(b.ruleId)
  );
}

function listTextFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTextFiles(path));
      continue;
    }
    if (!entry.isFile() || !hasScannedExtension(entry.name)) continue;
    out.push(path);
  }
  return out.sort();
}

function hasScannedExtension(name: string): boolean {
  const dot = name.lastIndexOf(".");
  return dot >= 0 && SCANNED_EXTENSIONS.has(name.slice(dot));
}

function isAllowed(path: string, ruleId: string, config: AgnosticGuardConfig): boolean {
  return config.allow.some((allowance) => {
    const prefix = allowance.pathPrefix.replace(/\/+$/, "");
    const pathMatches = path === prefix || path.startsWith(`${prefix}/`);
    return pathMatches && allowance.rules.includes(ruleId);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
