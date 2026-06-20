import type { ParsedCommandArgs } from "../cli/args.ts";
import {
  CleanCatalogPolicy,
  Command,
  type CommandContext,
  ForbidPositionalArguments,
} from "../cli/command.ts";
import { BooleanParameter, ValueParameter } from "../cli/parameter.ts";
import { CommandResult } from "../cli/result.ts";
import { ROOT_PARAMETER } from "../cli/root.ts";
import { type Card, type CardType, cardKey } from "../lib/types.ts";

class TypeParameter extends ValueParameter<"--type"> {
  constructor() {
    super("--type", "--type T", "Restrict to one type");
  }
}

class AliasesParameter extends BooleanParameter<"--aliases"> {
  constructor() {
    super("--aliases", "--aliases", "Include each card's aliases");
  }
}

class JsonParameter extends BooleanParameter<"--json"> {
  constructor() {
    super("--json", "--json", "Machine-readable output");
  }
}

const TYPE_PARAMETER = Object.freeze(new TypeParameter());
const ALIASES_PARAMETER = Object.freeze(new AliasesParameter());
const JSON_PARAMETER = Object.freeze(new JsonParameter());

export interface ListOptions {
  readonly json: boolean;
  /** Filter to a single type dir under brain/. */
  readonly type?: CardType;
  /** Include each card's aliases beside its canonical name. */
  readonly aliases: boolean;
}

interface JsonEntry {
  readonly type: CardType;
  readonly name: string;
  readonly aliases?: readonly string[];
}

/**
 * Browse the catalog. Default: every card as `<type>/<name>` to stdout.
 * `--type T` restricts to one type. `--aliases` adds alias info.
 */
export function runList(cards: readonly Card[], opts: ListOptions): void {
  const filtered = opts.type ? cards.filter((c) => c.id.type === opts.type) : cards;

  if (opts.json) {
    const entries: JsonEntry[] = filtered.map((c) => ({
      type: c.id.type,
      name: c.id.name,
      ...(opts.aliases ? { aliases: c.frontmatter.aliases ?? [] } : {}),
    }));
    process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
    return;
  }

  for (const c of filtered) {
    const head = cardKey(c.id);
    const aliases = c.frontmatter.aliases ?? [];
    if (!opts.aliases || aliases.length === 0) {
      process.stdout.write(`${head}\n`);
    } else {
      process.stdout.write(`${head}  (${aliases.join(", ")})\n`);
    }
  }
}

export class ListCommand extends Command<"list", ListOptions> {
  readonly name = "list";
  readonly summary = "List catalog cards as <type>/<name>";
  readonly parameters = Object.freeze([
    TYPE_PARAMETER,
    ALIASES_PARAMETER,
    JSON_PARAMETER,
    ROOT_PARAMETER,
  ]);
  readonly positionals = Object.freeze(new ForbidPositionalArguments());
  readonly catalog = Object.freeze(new CleanCatalogPolicy(ROOT_PARAMETER));

  protected decode(args: ParsedCommandArgs): ListOptions {
    const type = args.value(TYPE_PARAMETER);
    return Object.freeze({
      json: args.has(JSON_PARAMETER),
      aliases: args.has(ALIASES_PARAMETER),
      ...(type === undefined ? {} : { type }),
    });
  }

  protected execute(context: CommandContext, options: ListOptions): CommandResult {
    runList(context.cards, options);
    return CommandResult.SUCCESS;
  }
}

export const listCommand = Object.freeze(new ListCommand());
