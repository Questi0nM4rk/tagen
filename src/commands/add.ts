import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";
import type { CatalogCard, Vocabulary } from "../lib/types";
import { getValidValues } from "../lib/vocabulary";

type RL = ReturnType<typeof createInterface>;

export interface AddStreams {
  input?: Readable;
  output?: Writable;
}

export async function runAdd(
  cards: CatalogCard[],
  vocab: Vocabulary,
  vaultDir: string,
  streams: AddStreams = {}
): Promise<void> {
  const rl = createInterface({
    input: streams.input ?? process.stdin,
    output: streams.output ?? process.stdout,
  });
  try {
    const name = await ask(rl, "Skill name: ");
    if (!name) return abort("No name provided.");
    if (cards.some((c) => c.skill === name)) {
      return abort(`Skill "${name}" already exists in graph.`);
    }

    const description = await ask(rl, "One-line description: ");
    if (!description) return abort("Description is required.");

    const phase = await askMulti(rl, vocab, "phase");
    const domain = await askMulti(rl, vocab, "domain");
    const language = await askSingle(rl, vocab, "language");
    const layer = await askSingle(rl, vocab, "layer");
    const concerns = await askMulti(rl, vocab, "concerns");

    const cardPath = join(vaultDir, "skills", `${name}.md`);
    if (existsSync(cardPath)) {
      return abort(`Card already exists at ${cardPath}`);
    }

    writeFileSync(
      cardPath,
      scaffoldCard({ name, description, phase, domain, language, layer, concerns })
    );
    process.stdout.write(`\nCreated: ${cardPath}\n`);
  } finally {
    rl.close();
  }
}

export interface ScaffoldArgs {
  name: string;
  description: string;
  phase: string[];
  domain: string[];
  language: string;
  layer: string;
  concerns: string[];
}

export function scaffoldCard(a: ScaffoldArgs): string {
  return `---
skill: ${a.name}
description: "${a.description.replace(/"/g, '\\"')}"
summary: []
tags:
  phase: [${a.phase.join(", ")}]
  domain: [${a.domain.join(", ")}]
  language: ${a.language}
  layer: ${a.layer}
  concerns: [${a.concerns.join(", ")}]
provides: []
requires: []
emits: []
consumes: []
surface:
  triggers: []
core:
  files: []
deep:
  subagents: []
  refs: []
  slots: {}
  validators: []
---

# ${a.name}

${a.description}
`;
}

async function ask(rl: RL, question: string): Promise<string> {
  return (await rl.question(question)).trim();
}

async function askMulti(
  rl: RL,
  vocab: Vocabulary,
  dimension: string
): Promise<string[]> {
  const valid = getValidValues(vocab, dimension);
  process.stdout.write(`\n${dimension}: ${valid.join(", ")}\n`);
  const answer = await ask(rl, `${dimension} (comma-separated): `);
  return answer
    .split(",")
    .map((v) => v.trim())
    .filter((v) => valid.includes(v));
}

async function askSingle(
  rl: RL,
  vocab: Vocabulary,
  dimension: string
): Promise<string> {
  const valid = getValidValues(vocab, dimension);
  process.stdout.write(`\n${dimension}: ${valid.join(", ")}\n`);
  const answer = await ask(rl, `${dimension}: `);
  if (valid.includes(answer)) return answer;
  const fallback = valid[0];
  if (!fallback) {
    process.stderr.write(`  No valid values for dimension "${dimension}"\n`);
    process.exit(1);
  }
  process.stdout.write(`  Invalid "${answer}" — using "${fallback}"\n`);
  return fallback;
}

function abort(msg: string): never {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}
