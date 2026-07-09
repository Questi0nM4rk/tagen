import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";
import { stringify as stringifyYaml } from "yaml";
import type { ParsedCommandArgs } from "../cli/args.ts";
import {
  CleanCatalogPolicy,
  Command,
  type CommandContext,
  ForbidPositionalArguments,
} from "../cli/command.ts";
import { fail } from "../cli/errors.ts";
import { CommandResult } from "../cli/result.ts";
import { knownTypesFromCards } from "../composition/index.ts";
import {
  type Card,
  type CardFrontmatter,
  type CardType,
  isSubagentHostType,
  KEBAB_NAME,
} from "../lib/types.ts";

type RL = ReturnType<typeof createInterface>;

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
  cards: readonly Card[],
  knownTypes: ReadonlySet<CardType>,
  brainDir: string,
  streams: AddStreams = {}
): Promise<void> {
  const rl = createInterface({
    input: streams.input ?? process.stdin,
    output: streams.output ?? process.stdout,
  });
  try {
    const args = await promptForCard(rl, cards, knownTypes);
    const corePath = writeCard(brainDir, args);
    process.stdout.write(`\nCreated: ${corePath}\n`);
  } finally {
    rl.close();
  }
}

export interface ScaffoldArgs {
  readonly type: CardType;
  readonly name: string;
  readonly description: string;
  readonly aliases: readonly string[];
  readonly requires: readonly string[];
  readonly uses: readonly string[];
  readonly subagents: readonly string[];
}

/**
 * Builds the CORE.md file content (frontmatter + body) from scaffold arguments.
 */
export function scaffoldCard(a: ScaffoldArgs): string {
  const frontmatter: CardFrontmatter = {
    description: a.description,
    ...(a.aliases.length === 0 ? {} : { aliases: a.aliases }),
    ...(a.requires.length === 0 ? {} : { requires: a.requires }),
    ...(a.uses.length === 0 ? {} : { uses: a.uses }),
    ...(a.subagents.length === 0 ? {} : { subagents: a.subagents }),
  };

  const yaml = stringifyYaml(frontmatter).trimEnd();
  return `---\n${yaml}\n---\n\n# ${a.name}\n\n${a.description}\n`;
}

async function promptForCard(
  rl: RL,
  cards: readonly Card[],
  knownTypes: ReadonlySet<CardType>
): Promise<ScaffoldArgs> {
  const type = await ask(
    rl,
    `Type (one of: ${[...knownTypes].sort().join(", ")} — or a new type name): `
  );
  validateName("type", type);

  const name = await ask(rl, `Card name (under brain/${type}/): `);
  validateName("card", name);
  if (cards.some((card) => card.id.type === type && card.id.name === name)) {
    abort(`Card already exists: ${type}/${name}`);
  }

  const description = await ask(rl, "One-line description: ");
  if (!description) abort("Description is required.");
  const aliases = await askList(rl, "Aliases (comma-separated, optional): ");
  const requires = await askList(
    rl,
    "Requires (type names, comma-separated, optional): "
  );
  const subagents = isSubagentHostType(type)
    ? await askList(
        rl,
        "Subagents (names under brain/subagent/, comma-separated, optional): "
      )
    : [];
  const uses =
    type === "subagent"
      ? await askList(rl, "Uses (canonical type/name IDs, comma-separated, optional): ")
      : [];

  return Object.freeze({
    type,
    name,
    description,
    aliases: Object.freeze(aliases),
    requires: Object.freeze(requires),
    uses: Object.freeze(uses),
    subagents: Object.freeze(subagents),
  });
}

function validateName(kind: "type" | "card", value: string): void {
  if (!value) abort(kind === "type" ? "No type provided." : "No name provided.");
  if (!KEBAB_NAME.test(value)) {
    const label = kind === "type" ? "type" : "card";
    abort(`Invalid ${label} name '${value}': must match [a-z][a-z0-9-]*`);
  }
}

function writeCard(brainDir: string, args: ScaffoldArgs): string {
  const cardDir = join(brainDir, args.type, args.name);
  if (existsSync(cardDir)) abort(`Card dir already exists at ${cardDir}`);
  mkdirSync(cardDir, { recursive: true });
  mkdirSync(join(cardDir, "references"), { recursive: true });
  const corePath = join(cardDir, "CORE.md");
  writeFileSync(corePath, scaffoldCard(args));
  return corePath;
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

function abort(message: string): never {
  fail(message);
}

export class AddCommand extends Command<"add", undefined> {
  readonly name = "add";
  readonly summary = "Scaffold a new card interactively (the only command that writes)";
  readonly parameters = Object.freeze([]);
  readonly positionals = Object.freeze(new ForbidPositionalArguments());
  readonly catalog = Object.freeze(new CleanCatalogPolicy());

  protected decode(_args: ParsedCommandArgs): undefined {
    return undefined;
  }

  protected async execute(context: CommandContext): Promise<CommandResult> {
    await runAdd(context.cards, knownTypesFromCards(context.cards), context.brainDir);
    return CommandResult.SUCCESS;
  }
}

export const addCommand = Object.freeze(new AddCommand());
