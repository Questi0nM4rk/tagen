import { existsSync, readFileSync, statSync } from "node:fs";
import Ajv from "ajv";
import { bodyLineCount } from "../lib/frontmatter.ts";
import {
  type Card,
  cardKey,
  KEBAB_NAME,
  type Protocol,
  SUBAGENT_HOST_TYPES,
} from "../lib/types.ts";

export interface ValidateOptions {
  verbose: boolean;
}

interface ValidationContext {
  cards: Card[];
  protocols: Protocol[];
  /** Absolute marketplace root (parent of brain/). Used to read disk paths. */
  root: string;
  /** Frontmatter parse errors keyed by `<type>/<name>`. */
  frontmatterErrors: Map<string, string[]>;
  /** Set of every type dir name under brain/. */
  knownTypes: Set<string>;
  /** Index keyed by `<type>/<name>`. */
  index: Map<string, Card>;
}

/**
 * Walk every rule, print every violation, never fast-fail. Exits 0 on a clean
 * tree, 1 on any violation. Caller resolves `cards`/`protocols`/`knownTypes`
 * via the catalog loader.
 */
export function runValidate(ctx: ValidationContext, opts: ValidateOptions): void {
  const violations: string[] = [];

  for (const card of ctx.cards) {
    checkFilesystem(card, violations);
    const fmErrors = ctx.frontmatterErrors.get(`${cardKey(card.id)}`);
    if (fmErrors)
      for (const e of fmErrors) violations.push(`${cardKey(card.id)}: ${e}`);
    checkRequires(card, ctx, violations);
    checkSubagentReferences(card, ctx, violations);
    checkValidatorScope(card, violations);
  }

  checkAliasesGlobal(ctx.cards, violations);
  for (const proto of ctx.protocols) checkProtocol(proto, ctx.root, violations);

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

function checkRequires(card: Card, ctx: ValidationContext, violations: string[]): void {
  for (const req of card.frontmatter.requires ?? []) {
    if (!ctx.knownTypes.has(req)) {
      violations.push(`${cardKey(card.id)}: unknown type in requires: ${req}`);
    }
  }
}

function checkSubagentReferences(
  card: Card,
  ctx: ValidationContext,
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
    if (!ctx.index.has(cardKey({ type: "subagent", name }))) {
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

function checkAliasesGlobal(cards: Card[], violations: string[]): void {
  const aliases = new Map<string, { type: string; name: string }>();
  const canonical = new Set<string>();
  for (const c of cards) canonical.add(c.id.name);

  for (const c of cards) {
    for (const alias of c.frontmatter.aliases ?? []) {
      if (canonical.has(alias)) {
        const target = cards.find((x) => x.id.name === alias);
        violations.push(
          `${alias}: collides with canonical name ${target?.id.type ?? "?"}/${alias}`
        );
      }
      const prior = aliases.get(alias);
      if (prior) {
        violations.push(
          `${alias}: collides between ${cardKey(prior)} and ${cardKey(c.id)}`
        );
      } else {
        aliases.set(alias, { type: c.id.type, name: c.id.name });
      }
    }
  }
}

function checkProtocol(proto: Protocol, root: string, violations: string[]): void {
  const tag = `protocol/${proto.id.name}`;
  const schemaAbs = `${root}/${proto.schemaPath}`;
  const validatorAbs = `${root}/${proto.validatorPath}`;

  if (!existsSync(schemaAbs)) {
    violations.push(`${tag}: missing schema.json`);
    return;
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

  let schema: object;
  try {
    schema = JSON.parse(readFileSync(schemaAbs, "utf8")) as object;
  } catch (err) {
    violations.push(`${tag}: schema.json parse error: ${(err as Error).message}`);
    return;
  }

  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);

  for (const ex of proto.validExamples) {
    const exAbs = `${root}/${ex}`;
    let payload: unknown;
    try {
      payload = JSON.parse(readFileSync(exAbs, "utf8"));
    } catch (err) {
      violations.push(`${tag}: ${ex} parse error: ${(err as Error).message}`);
      continue;
    }
    if (!validate(payload)) violations.push(`${tag}: ${ex} fails schema`);
  }
  for (const ex of proto.invalidExamples) {
    const exAbs = `${root}/${ex}`;
    let payload: unknown;
    try {
      payload = JSON.parse(readFileSync(exAbs, "utf8"));
    } catch (err) {
      violations.push(`${tag}: ${ex} parse error: ${(err as Error).message}`);
      continue;
    }
    if (validate(payload)) violations.push(`${tag}: ${ex} passes schema (should fail)`);
  }
}
