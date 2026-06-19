import {
  booleanFlag,
  defineCommand,
  type ParsedCommandArgs,
  repeatableValueFlag,
} from "../cli/command.ts";
import { fail } from "../cli/errors.ts";
import { ROOT_FLAG } from "../cli/root.ts";
import { type ComposeQuery, compose, knownTypesFromCards } from "../lib/compose.ts";
import type { Card, CardId } from "../lib/types.ts";
import { runList } from "./list.ts";

const TYPE_FLAG = repeatableValueFlag(
  "--type",
  "--type T",
  "Select an explicit card type (paired with --name)"
);
const NAME_FLAG = repeatableValueFlag(
  "--name",
  "--name N",
  "Select an explicit card name (paired with --type)"
);
const PIN_FLAG = repeatableValueFlag(
  "--pin",
  "--pin <type>=<name>",
  "Force a card to fill a slot"
);
const JSON_FLAG = booleanFlag(
  "--json",
  "--json",
  "Machine-readable manifest (default)"
);

export interface GetOptions {
  json: boolean;
}

interface GetCommandOptions {
  query: ComposeQuery;
  output: GetOptions;
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
  cards: Card[],
  root: string,
  query: ComposeQuery,
  opts: GetOptions
): void {
  const knownTypes = knownTypesFromCards(cards);
  const outcome = compose(cards, root, query, knownTypes);

  if (outcome.errors.length > 0) {
    for (const e of outcome.errors) process.stderr.write(`tagen: ${e}\n`);
    process.exit(1);
  }

  if (outcome.browseTypes.length > 0 && !outcome.manifest) {
    for (const type of outcome.browseTypes) {
      runList(cards, { json: opts.json, type, aliases: false });
    }
    return;
  }

  if (outcome.emptyMatch || !outcome.manifest) {
    process.stderr.write("tagen: no cards matched the query\n");
    process.exit(2);
  }

  for (const w of outcome.manifest.warnings) {
    process.stderr.write(`tagen: ${w}\n`);
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(outcome.manifest, null, 2)}\n`);
    return;
  }

  const m = outcome.manifest;
  process.stdout.write(
    `${m.modules.length} card(s), ${m.slots.length} slot(s), ${m.warnings.length} warning(s).\n`
  );
  process.stdout.write("Use --json for the full manifest.\n");
}

export function buildComposeQuery(args: ParsedCommandArgs): ComposeQuery {
  const query: ComposeQuery = {
    positional: [...args.positional],
    explicit: [],
    pins: new Map(),
  };
  const types = args.values(TYPE_FLAG);
  const names = args.values(NAME_FLAG);
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
    query.explicit.push(id);
  }

  for (const pin of args.values(PIN_FLAG)) {
    const separator = pin.indexOf("=");
    if (separator <= 0 || separator === pin.length - 1) {
      fail(`invalid --pin '${pin}', expected <type>=<name>`);
    }
    query.pins.set(pin.slice(0, separator), pin.slice(separator + 1));
  }
  return query;
}

export const getCommand = defineCommand({
  name: "get",
  summary: "Resolve a composition into a JSON manifest (--json)",
  flags: [TYPE_FLAG, NAME_FLAG, PIN_FLAG, JSON_FLAG, ROOT_FLAG],
  positional: "allow",
  positionalHelp: [
    "<args>...        Positional, fuzzy-matched against canonical names + aliases",
    "                 (min 3 chars). A bare type-name triggers browse intent.",
  ],
  catalog: { policy: "clean", rootFlag: ROOT_FLAG },
  decode(args): GetCommandOptions {
    return {
      query: buildComposeQuery(args),
      output: { json: args.has(JSON_FLAG) },
    };
  },
  execute(context, options) {
    runGet(context.cards, context.root, options.query, options.output);
  },
});
