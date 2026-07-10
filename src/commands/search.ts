import type { ParsedCommandArgs } from "../cli/args.ts";
import {
  CleanCatalogPolicy,
  Command,
  type CommandContext,
  PositionalArgumentsPolicy,
} from "../cli/command.ts";
import { fail } from "../cli/errors.ts";
import { BooleanParameter, ValueParameter } from "../cli/parameter.ts";
import { CommandResult } from "../cli/result.ts";
import { ROOT_PARAMETER } from "../cli/root.ts";
import { CORE_FILE } from "../lib/catalog.ts";
import { type Card, type CardType, cardKey } from "../lib/types.ts";
import { type CardSearchResult, SearchQuery, searchCards } from "../search/index.ts";

class TypeParameter extends ValueParameter<"--type"> {
  constructor() {
    super("--type", "--type T", "Restrict the search to one card type");
  }
}

class JsonParameter extends BooleanParameter<"--json"> {
  constructor() {
    super("--json", "--json", "Machine-readable ranked results (uncapped)");
  }
}

/** `search` is meaningless without a query — require ≥1 non-blank positional term. */
class QueryTermsPolicy extends PositionalArgumentsPolicy {
  validate(commandName: string, values: readonly string[]): void {
    if (values.every((value) => value.trim() === "")) {
      fail(`'${commandName}' requires at least one query term`);
    }
  }
}

const TYPE_PARAMETER = Object.freeze(new TypeParameter());
const JSON_PARAMETER = Object.freeze(new JsonParameter());

/** Text mode shows the top N cards; --json is uncapped. */
export const TEXT_RESULT_CAP = 20;

export interface SearchOptions {
  readonly terms: readonly string[];
  readonly json: boolean;
  /** Filter to a single type dir under brain/. */
  readonly type?: CardType;
}

/**
 * Full-text fuzzy search across all card content, card-ranked.
 *
 * Exit codes: 0 (results found), 1 (no matches — agents branch on it).
 */
export function runSearch(
  cards: readonly Card[],
  root: string,
  opts: SearchOptions
): CommandResult {
  const scoped = opts.type ? cards.filter((c) => c.id.type === opts.type) : cards;
  const results = searchCards(scoped, root, new SearchQuery(opts.terms));

  if (results.length === 0) {
    process.stderr.write(`tagen: no cards match '${opts.terms.join(" ")}'\n`);
    return CommandResult.failure(1);
  }

  if (opts.json) {
    const entries = results.map((r) => ({
      type: r.id.type,
      name: r.id.name,
      tokensMatched: r.tokensMatched,
      tokensTotal: r.tokensTotal,
      matches: r.matches,
      files: r.files,
    }));
    process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
    return CommandResult.SUCCESS;
  }

  writeTextResults(results);
  return CommandResult.SUCCESS;
}

/** Aligned columns: `<type>/<name>  <d>/<t> tokens  <n> match(es)  <best file>`. */
function writeTextResults(results: readonly CardSearchResult[]): void {
  const shown = results.slice(0, TEXT_RESULT_CAP);
  const rows = shown.map((r) => ({
    key: cardKey(r.id),
    tokens: `${r.tokensMatched}/${r.tokensTotal} tokens`,
    matches: `${r.matches} match(es)`,
    bestFile: r.files[0]?.path ?? CORE_FILE,
  }));
  const keyWidth = Math.max(...rows.map((row) => row.key.length));
  const tokensWidth = Math.max(...rows.map((row) => row.tokens.length));
  const matchesWidth = Math.max(...rows.map((row) => row.matches.length));

  for (const row of rows) {
    process.stdout.write(
      `${row.key.padEnd(keyWidth)}  ${row.tokens.padEnd(tokensWidth)}  ` +
        `${row.matches.padEnd(matchesWidth)}  ${row.bestFile}\n`
    );
  }
  if (results.length > shown.length) {
    process.stdout.write(`… and ${results.length - shown.length} more.\n`);
  }
  process.stdout.write(`${results.length} card(s) matched.\n`);
}

export class SearchCommand extends Command<"search", SearchOptions> {
  readonly name = "search";
  readonly summary = "Full-text fuzzy search across card content, card-ranked";
  readonly parameters = Object.freeze([TYPE_PARAMETER, JSON_PARAMETER, ROOT_PARAMETER]);
  readonly positionals = Object.freeze(new QueryTermsPolicy());
  readonly positionalHelp = Object.freeze([
    "<query>...       Query terms matched against card body text (CORE.md +",
    "                 references). Substring match, plus 1-typo tolerance for",
    "                 terms of 4+ chars.",
  ]);
  readonly catalog = Object.freeze(new CleanCatalogPolicy(ROOT_PARAMETER));

  protected decode(args: ParsedCommandArgs): SearchOptions {
    const type = args.value(TYPE_PARAMETER);
    return Object.freeze({
      terms: args.positional,
      json: args.has(JSON_PARAMETER),
      ...(type === undefined ? {} : { type }),
    });
  }

  protected execute(context: CommandContext, options: SearchOptions): CommandResult {
    return runSearch(context.cards, context.root, options);
  }
}

export const searchCommand = Object.freeze(new SearchCommand());
