import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { errorMessage, isRecord } from "./errors.ts";

export interface AdditionalTerm {
  id: string;
  term: string;
  caseSensitive: boolean;
}

export interface GuardAllowance {
  pathPrefix: string;
  rules: string[];
}

export interface AgnosticGuardConfig {
  additionalTerms: AdditionalTerm[];
  allow: GuardAllowance[];
}

export interface ConfigLoadResult {
  config: AgnosticGuardConfig;
  errors: string[];
}

const CONFIG_PATH = [".tagen", "agnostic-guard.json"] as const;
const TOP_LEVEL_KEYS = new Set(["version", "additionalTerms", "allow"]);
const TERM_KEYS = new Set(["id", "term", "caseSensitive"]);
const ALLOW_KEYS = new Set(["pathPrefix", "rules"]);

export function loadAgnosticConfig(
  root: string,
  builtInRuleIds: ReadonlySet<string>
): ConfigLoadResult {
  const path = join(root, ...CONFIG_PATH);
  const empty: AgnosticGuardConfig = { additionalTerms: [], allow: [] };
  if (!existsSync(path)) return { config: empty, errors: [] };

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return {
      config: empty,
      errors: [`${CONFIG_PATH.join("/")}: invalid JSON: ${errorMessage(error)}`],
    };
  }
  if (!isRecord(raw)) {
    return {
      config: empty,
      errors: [`${CONFIG_PATH.join("/")}: config must be a JSON object`],
    };
  }

  const errors: string[] = [];
  rejectUnknownKeys(raw, TOP_LEVEL_KEYS, "config", errors);
  if (raw.version !== 1) errors.push("config: version must be 1");

  const additionalTerms = parseTerms(raw.additionalTerms, builtInRuleIds, errors);
  const knownRuleIds = new Set([
    ...builtInRuleIds,
    ...additionalTerms.map((term) => term.id),
  ]);
  const allow = parseAllowances(raw.allow, knownRuleIds, errors);

  return { config: { additionalTerms, allow }, errors };
}

function parseTerms(
  value: unknown,
  reservedIds: ReadonlySet<string>,
  errors: string[]
): AdditionalTerm[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push("config: additionalTerms must be an array");
    return [];
  }
  const out: AdditionalTerm[] = [];
  const ids = new Set<string>();
  for (const [index, item] of value.entries()) {
    const tag = `config: additionalTerms[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${tag} must be an object`);
      continue;
    }
    rejectUnknownKeys(item, TERM_KEYS, tag, errors);
    const id = item.id;
    const term = item.term;
    const caseSensitive = item.caseSensitive;
    if (typeof id !== "string" || id.length === 0) {
      errors.push(`${tag}.id must be a non-empty string`);
      continue;
    }
    if (ids.has(id)) errors.push(`${tag}.id duplicates '${id}'`);
    if (reservedIds.has(id)) {
      errors.push(`${tag}.id conflicts with built-in rule '${id}'`);
    }
    ids.add(id);
    if (typeof term !== "string" || term.length === 0) {
      errors.push(`${tag}.term must be a non-empty string`);
      continue;
    }
    if (typeof caseSensitive !== "boolean") {
      errors.push(`${tag}.caseSensitive must be a boolean`);
      continue;
    }
    out.push({ id, term, caseSensitive });
  }
  return out;
}

function parseAllowances(
  value: unknown,
  knownRuleIds: ReadonlySet<string>,
  errors: string[]
): GuardAllowance[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push("config: allow must be an array");
    return [];
  }
  const out: GuardAllowance[] = [];
  for (const [index, item] of value.entries()) {
    const tag = `config: allow[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${tag} must be an object`);
      continue;
    }
    rejectUnknownKeys(item, ALLOW_KEYS, tag, errors);
    const pathPrefix = item.pathPrefix;
    const rules = item.rules;
    if (
      typeof pathPrefix !== "string" ||
      !pathPrefix.startsWith("brain/") ||
      pathPrefix.includes("..")
    ) {
      errors.push(`${tag}.pathPrefix must stay under brain/`);
      continue;
    }
    if (!isStringArray(rules) || rules.length === 0) {
      errors.push(`${tag}.rules must be a non-empty string array`);
      continue;
    }
    for (const rule of rules) {
      if (!knownRuleIds.has(rule)) errors.push(`${tag}: unknown rule id '${rule}'`);
    }
    out.push({ pathPrefix, rules });
  }
  return out;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  tag: string,
  errors: string[]
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${tag}: unknown key '${key}'`);
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
