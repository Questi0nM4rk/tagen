import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";
import {
  type Card,
  type CardType,
  KEBAB_NAME,
  SUBAGENT_HOST_TYPES,
} from "../lib/types.ts";

type RL = ReturnType<typeof createInterface>;

const VALID_MODELS = ["haiku", "sonnet", "opus"] as const;

export interface AddStreams {
  input?: Readable;
  output?: Writable;
}

/**
 * Interactive scaffold for a new card. Prompts for type, name, description,
 * then type-appropriate optional fields. Writes brain/<type>/<name>/CORE.md
 * + an empty references/ dir.
 */
export async function runAdd(
  cards: Card[],
  knownTypes: Set<CardType>,
  brainDir: string,
  streams: AddStreams = {}
): Promise<void> {
  const rl = createInterface({
    input: streams.input ?? process.stdin,
    output: streams.output ?? process.stdout,
  });
  try {
    const type = await ask(
      rl,
      `Type (one of: ${[...knownTypes].sort().join(", ")} — or a new type name): `
    );
    if (!type) return abort("No type provided.");
    if (!KEBAB_NAME.test(type)) {
      return abort(`Invalid type name '${type}': must match [a-z][a-z0-9-]*`);
    }

    const name = await ask(rl, `Card name (under brain/${type}/): `);
    if (!name) return abort("No name provided.");
    if (!KEBAB_NAME.test(name)) {
      return abort(`Invalid card name '${name}': must match [a-z][a-z0-9-]*`);
    }
    if (cards.some((c) => c.id.type === type && c.id.name === name)) {
      return abort(`Card already exists: ${type}/${name}`);
    }

    const description = await ask(rl, "One-line description: ");
    if (!description) return abort("Description is required.");

    const aliases = await askList(rl, "Aliases (comma-separated, optional): ");
    const requires = await askList(
      rl,
      "Requires (type names, comma-separated, optional): "
    );

    let subagents: string[] = [];
    if (SUBAGENT_HOST_TYPES.has(type)) {
      subagents = await askList(
        rl,
        "Subagents (names under brain/subagent/, comma-separated, optional): "
      );
    }

    let model: (typeof VALID_MODELS)[number] | undefined;
    if (type === "subagent") {
      const answer = await ask(rl, `Model (${VALID_MODELS.join(" / ")}): `);
      if (!isValidModel(answer)) {
        return abort(
          `Invalid model '${answer}': must be one of ${VALID_MODELS.join(", ")}`
        );
      }
      model = answer;
    }

    const cardDir = join(brainDir, type, name);
    if (existsSync(cardDir)) return abort(`Card dir already exists at ${cardDir}`);
    mkdirSync(cardDir, { recursive: true });
    mkdirSync(join(cardDir, "references"), { recursive: true });

    const corePath = join(cardDir, "CORE.md");
    writeFileSync(
      corePath,
      scaffoldCard({
        type,
        name,
        description,
        aliases,
        requires,
        subagents,
        model,
      })
    );
    process.stdout.write(`\nCreated: ${corePath}\n`);
  } finally {
    rl.close();
  }
}

export interface ScaffoldArgs {
  type: CardType;
  name: string;
  description: string;
  aliases: string[];
  requires: string[];
  subagents: string[];
  model?: "haiku" | "sonnet" | "opus";
}

export function scaffoldCard(a: ScaffoldArgs): string {
  const lines: string[] = ["---"];
  lines.push(`description: "${a.description.replace(/"/g, '\\"')}"`);
  if (a.aliases.length > 0) lines.push(`aliases: [${a.aliases.join(", ")}]`);
  if (a.requires.length > 0) lines.push(`requires: [${a.requires.join(", ")}]`);
  if (a.subagents.length > 0) lines.push(`subagents: [${a.subagents.join(", ")}]`);
  if (a.model) lines.push(`model: ${a.model}`);
  lines.push("---", "", `# ${a.name}`, "", a.description, "");
  return lines.join("\n");
}

async function ask(rl: RL, question: string): Promise<string> {
  return (await rl.question(question)).trim();
}

async function askList(rl: RL, question: string): Promise<string[]> {
  const answer = await ask(rl, question);
  if (!answer) return [];
  return answer
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function isValidModel(s: string): s is (typeof VALID_MODELS)[number] {
  return (VALID_MODELS as readonly string[]).includes(s);
}

function abort(msg: string): never {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}
