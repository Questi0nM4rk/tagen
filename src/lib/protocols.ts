import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ProtocolEntry } from "./types";

/**
 * Discover protocols from skill-graph/protocols/<name>/ directories.
 *
 * A valid protocol directory has:
 *   schema.json   — JSON Schema
 *   protocol.md   — semantic doc
 *   validator.ts  — executable schema validator
 *   examples/valid/*.json     — at least one valid fixture
 *   examples/invalid/*.json   — at least one invalid fixture
 *
 * loadProtocols returns one entry per subdirectory under protocols/, with
 * booleans for each required artifact so `validate` can report missing
 * pieces individually.
 */
export function loadProtocols(vaultDir: string): ProtocolEntry[] {
  const protocolsDir = join(vaultDir, "protocols");
  if (!existsSync(protocolsDir)) return [];

  const entries: ProtocolEntry[] = [];
  for (const name of readdirSync(protocolsDir)) {
    const dirPath = join(protocolsDir, name);
    if (!statSync(dirPath).isDirectory()) continue;

    entries.push({
      name,
      dirPath,
      hasSchema: existsSync(join(dirPath, "schema.json")),
      hasDoc: existsSync(join(dirPath, "protocol.md")),
      hasValidator: existsSync(join(dirPath, "validator.ts")),
      hasValidExamples: dirHasJsonFile(join(dirPath, "examples", "valid")),
      hasInvalidExamples: dirHasJsonFile(join(dirPath, "examples", "invalid")),
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

function dirHasJsonFile(dir: string): boolean {
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => f.endsWith(".json"));
}

export function allProtocolNames(protocols: ProtocolEntry[]): string[] {
  return protocols.map((p) => p.name);
}

export function isValidProtocol(protocols: ProtocolEntry[], name: string): boolean {
  return protocols.some((p) => p.name === name);
}
