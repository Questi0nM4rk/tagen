import type { ParsedCommandArgs } from "../cli/args.ts";
import {
  AllowPositionalArguments,
  CleanCatalogPolicy,
  Command,
  type CommandContext,
} from "../cli/command.ts";
import { fail } from "../cli/errors.ts";
import { BooleanParameter, RepeatableValueParameter } from "../cli/parameter.ts";
import { CommandResult } from "../cli/result.ts";
import { ROOT_PARAMETER } from "../cli/root.ts";
import {
  type ComposeQuery,
  compose,
  knownTypesFromCards,
} from "../composition/index.ts";
import { ImmutableMap } from "../lib/immutable-collections.ts";
import type { Card, CardId } from "../lib/types.ts";
import { runList } from "./list.ts";

class TypeParameter extends RepeatableValueParameter<"--type"> {
  constructor() {
    super("--type", "--type T", "Select an explicit card type (paired with --name)");
  }
}

class NameParameter extends RepeatableValueParameter<"--name"> {
  constructor() {
    super("--name", "--name N", "Select an explicit card name (paired with --type)");
  }
}

class PinParameter extends RepeatableValueParameter<"--pin"> {
  constructor() {
    super("--pin", "--pin <type>=<name>", "Force a card to fill a slot");
  }
}

class JsonParameter extends BooleanParameter<"--json"> {
  constructor() {
    super("--json", "--json", "Machine-readable manifest (default)");
  }
}

const TYPE_PARAMETER = Object.freeze(new TypeParameter());
const NAME_PARAMETER = Object.freeze(new NameParameter());
const PIN_PARAMETER = Object.freeze(new PinParameter());
const JSON_PARAMETER = Object.freeze(new JsonParameter());

export interface GetOptions {
  readonly json: boolean;
}

class GetCommandOptions {
  readonly query: ComposeQuery;
  readonly output: GetOptions;

  constructor(query: ComposeQuery, output: GetOptions) {
    this.query = query;
    this.output = Object.freeze({ ...output });
    Object.freeze(this);
  }
}

/**
 * Resolve a composition into a JSON manifest. Bare type-name positional args
 * trigger a browse intent (delegated to `runList --type T`).
 *
 * Exit codes per SPEC-tagen:
 *   0 — manifest emitted (warnings allowed) OR browse listing emitted
 *   1 — user/validation error (ambiguous arg, unknown card)
 *   2 — empty match set
 */
export function runGet(
  cards: readonly Card[],
  root: string,
  query: ComposeQuery,
  opts: GetOptions
): CommandResult {
  const knownTypes = knownTypesFromCards(cards);
  const outcome = compose(cards, root, query, knownTypes);

  if (outcome.errors.length > 0) {
    for (const e of outcome.errors) process.stderr.write(`tagen: ${e}\n`);
    return CommandResult.failure(1);
  }

  if (outcome.browseTypes.length > 0 && !outcome.manifest) {
    for (const type of outcome.browseTypes) {
      runList(cards, { json: opts.json, type, aliases: false });
    }
    return CommandResult.SUCCESS;
  }

  if (outcome.emptyMatch || !outcome.manifest) {
    process.stderr.write("tagen: no cards matched the query\n");
    return CommandResult.failure(2);
  }

  for (const w of outcome.manifest.warnings) {
    process.stderr.write(`tagen: ${w}\n`);
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(outcome.manifest, null, 2)}\n`);
    return CommandResult.SUCCESS;
  }

  const m = outcome.manifest;
  process.stdout.write(
    `${m.modules.length} card(s), ${m.slots.length} slot(s), ${m.warnings.length} warning(s).\n`
  );
  process.stdout.write("Use --json for the full manifest.\n");
  return CommandResult.SUCCESS;
}

export function buildComposeQuery(args: ParsedCommandArgs): ComposeQuery {
  const explicit: CardId[] = [];
  const pins = new Map<string, string>();
  const types = args.values(TYPE_PARAMETER);
  const names = args.values(NAME_PARAMETER);
  if (types.length !== names.length) {
    fail("--type and --name must be paired");
  }
  for (let index = 0; index < types.length; index++) {
    const type = types[index];
    const name = names[index];
    if (type === undefined || name === undefined) {
      throw new Error("paired --type/--name arguments were not preserved");
    }
    const id: CardId = { type, name };
    explicit.push(Object.freeze(id));
  }

  for (const pin of args.values(PIN_PARAMETER)) {
    const separator = pin.indexOf("=");
    if (separator <= 0 || separator === pin.length - 1) {
      fail(`invalid --pin '${pin}', expected <type>=<name>`);
    }
    pins.set(pin.slice(0, separator), pin.slice(separator + 1));
  }
  return Object.freeze({
    positional: Object.freeze([...args.positional]),
    explicit: Object.freeze(explicit),
    pins: new ImmutableMap(pins),
  });
}

export class GetCommand extends Command<"get", GetCommandOptions> {
  readonly name = "get";
  readonly summary = "Resolve a composition into a JSON manifest (--json)";
  readonly parameters = Object.freeze([
    TYPE_PARAMETER,
    NAME_PARAMETER,
    PIN_PARAMETER,
    JSON_PARAMETER,
    ROOT_PARAMETER,
  ]);
  readonly positionals = Object.freeze(new AllowPositionalArguments());
  readonly positionalHelp = Object.freeze([
    "<args>...        Positional, fuzzy-matched against canonical names + aliases",
    "                 (min 3 chars). A bare type-name triggers browse intent.",
  ]);
  readonly catalog = Object.freeze(new CleanCatalogPolicy(ROOT_PARAMETER));

  protected decode(args: ParsedCommandArgs): GetCommandOptions {
    return new GetCommandOptions(buildComposeQuery(args), {
      json: args.has(JSON_PARAMETER),
    });
  }

  protected execute(
    context: CommandContext,
    options: GetCommandOptions
  ): CommandResult {
    return runGet(context.cards, context.root, options.query, options.output);
  }
}

export const getCommand = Object.freeze(new GetCommand());
