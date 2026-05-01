#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Ajv from "ajv";
import { fail, pass, readPayload } from "../../../../../src/validator-runtime.ts";

const schemaPath = join(dirname(new URL(import.meta.url).pathname), "schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

const payload = await readPayload<unknown>();
if (validate(payload)) pass();
fail((validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`));
