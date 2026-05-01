import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAdd } from "./commands/add.ts";
import { runGet } from "./commands/get.ts";
import { runList } from "./commands/list.ts";
import { runValidate } from "./commands/validate.ts";
import { findBrainDir, loadAllCards, marketplaceRoot } from "./lib/catalog.ts";
import { type ComposeQuery, emptyQuery, knownTypesFromCards } from "./lib/compose.ts";
import { type CardId, type CardType, cardKey } from "./lib/types.ts";

const USAGE = `tagen — read-only CLI for a brain/ directory of typed cards

Usage: tagen <command> [options]

Commands:
  list       List catalog cards as <type>/<name>
  validate   Walk the tree and report every rule violation; exit non-zero on any
  get        Resolve a composition into a JSON manifest (--json)
  add        Scaffold a new card interactively (the only command that writes)

list:
  --type T         Restrict to one type
  --aliases        Include each card's aliases
  --json           Machine-readable output

get:
  <args>...        Positional, fuzzy-matched against canonical names + aliases
                   (min 3 chars). A bare type-name (e.g. 'methodology') triggers
                   browse intent — equivalent to 'list --type T'.
  --type T --name N      Explicit (type, name) selection (paired, repeatable)
  --pin <type>=<name>    Force a card to fill a slot (repeatable)
  --json                 Machine-readable manifest (default)

validate:
  --verbose         Per-card per-rule trace

Common:
  --help / -h       Show this help
  --version / -V    Print version
`;

const KNOWN_COMMANDS = new Set(["validate", "list", "get", "add"]);

function readBundledVersion(): string {
  const pkgPath = join(import.meta.dir, "..", "package.json");
  const raw = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? "unknown";
}

interface ParsedArgs {
  positional: string[];
  flags: Map<string, string[]>;
  bools: Set<string>;
}

const REPEAT_PAIR_FLAGS = new Set(["--type", "--name", "--pin"]);
const BOOLEAN_FLAGS = new Set(["--json", "--verbose", "--aliases"]);

function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  const bools = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (BOOLEAN_FLAGS.has(arg)) {
      bools.add(arg);
      continue;
    }
    if (REPEAT_PAIR_FLAGS.has(arg)) {
      const v = args[i + 1];
      if (v === undefined) {
        process.stderr.write(`tagen: ${arg} requires a value\n`);
        process.exit(1);
      }
      const list = flags.get(arg) ?? [];
      list.push(v);
      flags.set(arg, list);
      i++;
      continue;
    }
    positional.push(arg);
  }
  return { positional, flags, bools };
}

function buildComposeQuery(parsed: ParsedArgs): ComposeQuery {
  const q = emptyQuery();
  q.positional = parsed.positional;

  const types = parsed.flags.get("--type") ?? [];
  const names = parsed.flags.get("--name") ?? [];
  if (types.length !== names.length) {
    process.stderr.write("tagen: --type and --name must be paired\n");
    process.exit(1);
  }
  for (let i = 0; i < types.length; i++) {
    const id: CardId = { type: types[i] as CardType, name: names[i] as string };
    q.explicit.push(id);
  }

  for (const pin of parsed.flags.get("--pin") ?? []) {
    const eq = pin.indexOf("=");
    if (eq <= 0 || eq === pin.length - 1) {
      process.stderr.write(`tagen: invalid --pin '${pin}', expected <type>=<name>\n`);
      process.exit(1);
    }
    q.pins.set(pin.slice(0, eq), pin.slice(eq + 1));
  }
  return q;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return;
  }
  if (command === "--version" || command === "-V") {
    process.stdout.write(`${readBundledVersion()}\n`);
    return;
  }
  if (!KNOWN_COMMANDS.has(command)) {
    process.stderr.write(
      `Unknown command: ${command}\nRun 'tagen --help' for usage.\n`
    );
    process.exit(1);
  }

  const restArgs = args.slice(1);
  const parsed = parseArgs(restArgs);
  const json = parsed.bools.has("--json");
  const verbose = parsed.bools.has("--verbose");
  const aliases = parsed.bools.has("--aliases");

  const brainDir = findBrainDir();
  const root = marketplaceRoot(brainDir);
  const { cards, protocols, frontmatterErrors } = loadAllCards(brainDir);

  switch (command) {
    case "list": {
      const typeFilter = parsed.flags.get("--type")?.[0];
      runList(cards, { json, type: typeFilter, aliases });
      return;
    }
    case "validate": {
      const knownTypes = knownTypesFromCards(cards);
      const index = new Map(cards.map((c) => [cardKey(c.id), c] as const));
      runValidate(
        { cards, protocols, root, frontmatterErrors, knownTypes, index },
        { verbose }
      );
      return;
    }
    case "get": {
      const query = buildComposeQuery(parsed);
      runGet(cards, root, query, { json });
      return;
    }
    case "add": {
      const knownTypes = knownTypesFromCards(cards);
      await runAdd(cards, knownTypes, brainDir);
      return;
    }
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal: ${msg}\n`);
  process.exit(2);
});
