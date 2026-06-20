import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import Ajv, { type AnySchema, type ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { errorMessage } from "../lib/errors.ts";
import type { Protocol } from "../lib/types.ts";

export function validateProtocols(
  protocols: readonly Protocol[],
  root: string
): readonly string[] {
  return Object.freeze(
    protocols.flatMap((protocol) => validateProtocol(protocol, root))
  );
}

function validateProtocol(proto: Protocol, root: string): readonly string[] {
  const violations: string[] = [];
  const tag = `protocol/${proto.id.name}`;
  const schemaPath = join(root, proto.schemaPath);
  const validatorPath = join(root, proto.validatorPath);

  const schemaExists = existsSync(schemaPath);
  if (!schemaExists) violations.push(`${tag}: missing schema.json`);
  if (!existsSync(validatorPath)) {
    violations.push(`${tag}: missing validator.ts`);
  } else if ((statSync(validatorPath).mode & 0o111) === 0) {
    violations.push(`${tag}: validator.ts not executable`);
  }
  if (proto.validExamples.length === 0) {
    violations.push(`${tag}: examples/valid must contain at least one .json payload`);
  }
  if (proto.invalidExamples.length === 0) {
    violations.push(`${tag}: examples/invalid must contain at least one .json payload`);
  }
  if (!schemaExists) return violations;

  const schema = readJsonSchema(schemaPath, tag, violations);
  if (schema === undefined) return violations;
  const validator = compileJsonSchema(schema, tag, violations);
  if (validator === undefined) return violations;

  violations.push(
    ...validateExamples(proto.validExamples, true, validator, root, tag),
    ...validateExamples(proto.invalidExamples, false, validator, root, tag)
  );
  return violations;
}

function readJsonSchema(
  path: string,
  tag: string,
  violations: string[]
): AnySchema | undefined {
  let schema: unknown;
  try {
    schema = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    violations.push(`${tag}: schema.json parse error: ${errorMessage(error)}`);
    return undefined;
  }
  if (!isJsonSchema(schema)) {
    violations.push(`${tag}: schema.json must contain an object or boolean schema`);
    return undefined;
  }
  return schema;
}

function compileJsonSchema(
  schema: AnySchema,
  tag: string,
  violations: string[]
): ValidateFunction | undefined {
  try {
    return ajvFor(schema).compile(schema);
  } catch (error) {
    violations.push(`${tag}: schema.json compile error: ${errorMessage(error)}`);
    return undefined;
  }
}

function ajvFor(schema: AnySchema): Ajv | Ajv2020 {
  const draft =
    typeof schema === "object" &&
    schema !== null &&
    "$schema" in schema &&
    typeof schema.$schema === "string"
      ? schema.$schema
      : "";
  return draft.includes("2020-12") || draft.includes("2019-09")
    ? new Ajv2020({ allErrors: true })
    : new Ajv({ allErrors: true });
}

function validateExamples(
  examples: readonly string[],
  expectPass: boolean,
  validate: ValidateFunction,
  root: string,
  tag: string
): readonly string[] {
  const violations: string[] = [];
  for (const example of examples) {
    let payload: unknown;
    try {
      payload = JSON.parse(readFileSync(join(root, example), "utf8"));
    } catch (error) {
      violations.push(`${tag}: ${example} parse error: ${errorMessage(error)}`);
      continue;
    }
    const passed = validate(payload);
    if (expectPass && !passed) violations.push(`${tag}: ${example} fails schema`);
    if (!expectPass && passed) {
      violations.push(`${tag}: ${example} passes schema (should fail)`);
    }
  }
  return violations;
}

function isJsonSchema(value: unknown): value is AnySchema {
  return (
    typeof value === "boolean" ||
    (value !== null && typeof value === "object" && !Array.isArray(value))
  );
}
