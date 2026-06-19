import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import Ajv, { type AnySchema, type ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { booleanFlag, defineCommand } from "../cli/command.ts";
import { loadAgnosticConfig } from "../lib/agnostic-config.ts";
import { findAliasCollisions } from "../lib/aliases.ts";
import { findUsesCycles, resolveUses } from "../lib/card-references.ts";
import { errorMessage } from "../lib/errors.ts";
import { bodyLineCount } from "../lib/frontmatter.ts";
import { BUILT_IN_RULE_IDS, findHarnessLeaks } from "../lib/harness-guard.ts";
import {
  type Card,
  cardIndex,
  cardKey,
  KEBAB_NAME,
  type Protocol,
  SUBAGENT_HOST_TYPES,
} from "../lib/types.ts";

const VERBOSE_FLAG = booleanFlag("--verbose", "--verbose", "Per-card per-rule trace");

export interface ValidateOptions {
  verbose: boolean;
}

export interface ValidationContext {
  cards: Card[];
  protocols: Protocol[];
  /** Absolute marketplace root (parent of brain/). Used to read disk paths. */
  root: string;
  /** Frontmatter parse errors keyed by `<type>/<name>`. */
  frontmatterErrors: Map<string, string[]>;
  /** Catalog-shape errors found before card parsing. */
  catalogErrors: string[];
}

/**
 * Walk every rule, print every violation, never fast-fail. Exits 0 on a clean
 * tree, 1 on any violation. Caller resolves `cards`/`protocols`/`knownTypes`
 * via the catalog loader.
 */
export function runValidate(ctx: ValidationContext, opts: ValidateOptions): void {
  const violations: string[] = [...ctx.catalogErrors];
  const knownTypes = new Set(ctx.cards.map((c) => c.id.type));
  const index = cardIndex(ctx.cards);

  for (const card of ctx.cards) {
    checkFilesystem(card, violations);
    const fmErrors = ctx.frontmatterErrors.get(cardKey(card.id));
    if (fmErrors)
      for (const e of fmErrors) violations.push(`${cardKey(card.id)}: ${e}`);
    checkRequires(card, knownTypes, violations);
    violations.push(...resolveUses(card, ctx.cards).errors);
    checkSubagentReferences(card, index, violations);
    checkValidatorScope(card, violations);
  }

  violations.push(...findAliasCollisions(ctx.cards));
  violations.push(...findUsesCycles(ctx.cards));
  for (const proto of ctx.protocols) checkProtocol(proto, ctx.root, violations);
  const configResult = loadAgnosticConfig(ctx.root, BUILT_IN_RULE_IDS);
  violations.push(...configResult.errors);
  if (configResult.errors.length === 0) {
    const brainDir = join(ctx.root, "brain");
    for (const leak of findHarnessLeaks(brainDir, ctx.root, configResult.config)) {
      violations.push(
        `${leak.path}:${leak.line}: harness leak [${leak.ruleId}]: ${leak.token}`
      );
    }
  }

  if (opts.verbose) {
    process.stderr.write(
      `tagen: scanned ${ctx.cards.length} card(s); ${violations.length} violation(s)\n`
    );
  }

  if (violations.length > 0) {
    process.stderr.write(violations.map((v) => `tagen: ${v}\n`).join(""));
  }

  process.exit(violations.length > 0 ? 1 : 0);
}

export const validateCommand = defineCommand({
  name: "validate",
  summary: "Walk the tree and report every rule violation; exit non-zero on any",
  flags: [VERBOSE_FLAG],
  positional: "forbid",
  catalog: "diagnostic",
  decode(args): ValidateOptions {
    return { verbose: args.has(VERBOSE_FLAG) };
  },
  execute(context, options) {
    runValidate(context, options);
  },
});

function checkFilesystem(card: Card, violations: string[]): void {
  if (!KEBAB_NAME.test(card.id.name)) {
    violations.push(`${cardKey(card.id)}: card name must match [a-z][a-z0-9-]*`);
  }
  if (!KEBAB_NAME.test(card.id.type)) {
    violations.push(`${card.id.type}: type name must match [a-z][a-z0-9-]*`);
  }
  if (!existsSync(card.corePath) || !statSync(card.corePath).isFile()) {
    violations.push(`${cardKey(card.id)}/CORE.md: must be a file`);
    return;
  }
  const lines = bodyLineCount(card.body);
  if (lines > 300) {
    violations.push(
      `${cardKey(card.id)}/CORE.md: exceeds 300 lines (got ${lines}); move overflow into references/`
    );
  }
}

function checkRequires(
  card: Card,
  knownTypes: Set<string>,
  violations: string[]
): void {
  for (const req of card.frontmatter.requires ?? []) {
    if (!knownTypes.has(req)) {
      violations.push(`${cardKey(card.id)}: unknown type in requires: ${req}`);
    }
  }
}

function checkSubagentReferences(
  card: Card,
  index: Map<string, Card>,
  violations: string[]
): void {
  if (!card.frontmatter.subagents?.length) return;
  if (!SUBAGENT_HOST_TYPES.has(card.id.type)) {
    violations.push(
      `${cardKey(card.id)}: subagents allowed only on review and methodology cards`
    );
    return;
  }
  for (const name of card.frontmatter.subagents) {
    if (!index.has(cardKey({ type: "subagent", name }))) {
      violations.push(`${cardKey(card.id)}: unknown subagent in subagents: ${name}`);
    }
  }
}

function checkValidatorScope(card: Card, violations: string[]): void {
  if (card.validators.length === 0) return;
  if (!SUBAGENT_HOST_TYPES.has(card.id.type)) {
    violations.push(
      `${cardKey(card.id)}: validators/ allowed only on review and methodology cards`
    );
  }
}

/** Pick the right ajv variant based on the schema's `$schema` URI. Default
 * Ajv handles draft-07; Ajv2020 handles 2019-09 and 2020-12. The two
 * builds use disjoint keyword sets so we can't share a single instance. */
function compileSchema(schema: AnySchema): ValidateFunction {
  const draft =
    typeof schema === "object" &&
    schema !== null &&
    "$schema" in schema &&
    typeof schema.$schema === "string"
      ? schema.$schema
      : "";
  const Variant =
    draft.includes("2020-12") || draft.includes("2019-09") ? Ajv2020 : Ajv;
  return new Variant({ allErrors: true }).compile(schema);
}

function checkProtocol(proto: Protocol, root: string, violations: string[]): void {
  const tag = `protocol/${proto.id.name}`;
  const schemaAbs = join(root, proto.schemaPath);
  const validatorAbs = join(root, proto.validatorPath);

  const schemaExists = existsSync(schemaAbs);
  if (!schemaExists) {
    violations.push(`${tag}: missing schema.json`);
  }
  if (!existsSync(validatorAbs)) {
    violations.push(`${tag}: missing validator.ts`);
  } else if ((statSync(validatorAbs).mode & 0o111) === 0) {
    violations.push(`${tag}: validator.ts not executable`);
  }

  if (proto.validExamples.length === 0) {
    violations.push(`${tag}: examples/valid must contain at least one .json payload`);
  }
  if (proto.invalidExamples.length === 0) {
    violations.push(`${tag}: examples/invalid must contain at least one .json payload`);
  }
  if (!schemaExists) return;

  let schema: unknown;
  try {
    schema = JSON.parse(readFileSync(schemaAbs, "utf8"));
  } catch (err) {
    violations.push(`${tag}: schema.json parse error: ${errorMessage(err)}`);
    return;
  }
  if (!isJsonSchema(schema)) {
    violations.push(`${tag}: schema.json must contain an object or boolean schema`);
    return;
  }

  let validate: ValidateFunction;
  try {
    validate = compileSchema(schema);
  } catch (err) {
    violations.push(`${tag}: schema.json compile error: ${errorMessage(err)}`);
    return;
  }

  checkExamples(proto.validExamples, true, validate, root, tag, violations);
  checkExamples(proto.invalidExamples, false, validate, root, tag, violations);
}

function checkExamples(
  examples: string[],
  expectPass: boolean,
  validate: ValidateFunction,
  root: string,
  tag: string,
  violations: string[]
): void {
  for (const ex of examples) {
    let payload: unknown;
    try {
      payload = JSON.parse(readFileSync(join(root, ex), "utf8"));
    } catch (err) {
      violations.push(`${tag}: ${ex} parse error: ${errorMessage(err)}`);
      continue;
    }
    const passed = validate(payload);
    if (expectPass && !passed) violations.push(`${tag}: ${ex} fails schema`);
    if (!expectPass && passed)
      violations.push(`${tag}: ${ex} passes schema (should fail)`);
  }
}

function isJsonSchema(value: unknown): value is AnySchema {
  return (
    typeof value === "boolean" ||
    (value !== null && typeof value === "object" && !Array.isArray(value))
  );
}
