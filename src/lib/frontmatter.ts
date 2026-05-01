import { parse as parseYaml } from "yaml";
import type { CardFrontmatter, CardType } from "./types.ts";

/**
 * Per-type allowed frontmatter fields per SPEC-tagen "Strict per-type field
 * allowlist" decision. Anything outside the allowlist for a given type is a
 * `tagen validate` error.
 */
const COMMON_FIELDS = ["description", "aliases", "requires"] as const;

const ALLOWED_FIELDS: Record<CardType, readonly string[]> = {
  review: [...COMMON_FIELDS, "subagents"],
  methodology: [...COMMON_FIELDS, "subagents"],
  subagent: [...COMMON_FIELDS, "model"],
  lang: COMMON_FIELDS,
  framework: COMMON_FIELDS,
  test: COMMON_FIELDS,
  architecture: COMMON_FIELDS,
  protocol: COMMON_FIELDS,
};

const VALID_MODELS = new Set(["haiku", "sonnet", "opus"]);

export interface ParseResult {
  frontmatter: CardFrontmatter;
  body: string;
  errors: string[];
}

/** Allowed-field set for a type. Unknown types fall back to common fields. */
function allowedFor(type: CardType): readonly string[] {
  return ALLOWED_FIELDS[type] ?? COMMON_FIELDS;
}

/**
 * Split a CORE.md file into YAML frontmatter and body. Returns the body
 * verbatim (newlines preserved). Errors are collected, never thrown — the
 * caller decides how to surface them.
 */
export function parseCore(source: string, type: CardType): ParseResult {
  const errors: string[] = [];
  const empty: CardFrontmatter = { description: "" };

  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    errors.push("CORE.md missing YAML frontmatter");
    return { frontmatter: empty, body: source, errors };
  }

  const yamlText = match[1] ?? "";
  const body = match[2] ?? "";

  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`CORE.md frontmatter parse error: ${msg}`);
    return { frontmatter: empty, body, errors };
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push("CORE.md frontmatter must be a YAML mapping");
    return { frontmatter: empty, body, errors };
  }

  const fm = raw as Record<string, unknown>;
  const allowed = new Set(allowedFor(type));
  for (const key of Object.keys(fm)) {
    if (!allowed.has(key)) {
      errors.push(`unknown frontmatter field for type '${type}': ${key}`);
    }
  }

  const description = fm.description;
  if (typeof description !== "string" || description.length === 0) {
    errors.push("missing required frontmatter field: description");
  }

  const out: CardFrontmatter = {
    description: typeof description === "string" ? description : "",
  };

  const aliases = fm.aliases;
  if (aliases !== undefined) {
    if (!isStringArray(aliases)) {
      errors.push("aliases must be an array of strings");
    } else {
      out.aliases = aliases;
    }
  }

  const requires = fm.requires;
  if (requires !== undefined) {
    if (!isStringArray(requires)) {
      errors.push("requires must be an array of strings");
    } else {
      out.requires = requires;
    }
  }

  if (allowed.has("subagents")) {
    const subagents = fm.subagents;
    if (subagents !== undefined) {
      if (!isStringArray(subagents)) {
        errors.push("subagents must be an array of strings");
      } else {
        out.subagents = subagents;
      }
    }
  }

  if (allowed.has("model")) {
    const model = fm.model;
    if (model === undefined) {
      errors.push("missing required field: model");
    } else if (typeof model !== "string" || !VALID_MODELS.has(model)) {
      errors.push(`unknown model: ${String(model)} (valid: haiku, sonnet, opus)`);
    } else {
      out.model = model as "haiku" | "sonnet" | "opus";
    }
  }

  return { frontmatter: out, body, errors };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** Body line count, excluding leading blank lines. Used by the ≤300-line rule. */
export function bodyLineCount(body: string): number {
  return body.replace(/^\s*\n+/, "").split("\n").length;
}
