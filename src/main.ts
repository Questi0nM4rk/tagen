import { runAdd } from "./commands/add";
import { runDemo } from "./commands/demo";
import { runGet } from "./commands/get";
import { runList } from "./commands/list";
import { runTags } from "./commands/tags";
import { runValidate } from "./commands/validate";
import {
  allCapabilities,
  isValidCapability,
  loadCapabilities,
} from "./lib/capabilities";
import { loadAllCards } from "./lib/catalog";
import type { ComposeQuery } from "./lib/compose";
import { loadProtocols } from "./lib/protocols";
import { loadSubagents } from "./lib/subagents";
import type { CapabilityRegistry, Vocabulary } from "./lib/types";
import {
  findVaultDir,
  getValidValues,
  loadVocabulary,
  repoRoot,
} from "./lib/vocabulary";

const USAGE = `tagen — skill graph CLI for qsm-marketplace

Usage: tagen <command> [options]

Commands:
  tags       Show controlled vocabulary
  validate   Check consistency of all catalog cards, protocols, and subagents
  list       List all skills with their tags
  demo       Preview a composition (matched cards + slot fills + warnings)
  get        Resolve a composition into a JSON manifest (--json)
  add        Scaffold a new catalog card interactively

Options:
  --help        Show this help
  --json        Output in JSON format (list, tags, get)
  --filter      Filter list by dimension=value (e.g. --filter layer=orchestrator)
  --domain      Composition tag filter (demo, get)
  --language    Composition tag filter (demo, get)
  --capability  Restrict matched set to providers of this capability (demo, get)
  --skill       Restrict matched set to a single skill (demo, get)
  --card NAME   Override slot resolution by listing exact cards (demo, get; repeatable)

Examples:
  tagen list
  tagen list --filter language=dotnet
  tagen tags --json
  tagen demo --language dotnet
  tagen get --language dotnet --json
  tagen get --skill strict-review --language dotnet --json
  tagen validate
`;

type FlagSetter = (q: ComposeQuery, value: string) => void;

const COMPOSE_FLAGS: Record<string, FlagSetter> = {
  "--domain": (q, v) => {
    q.domain = v;
  },
  "--language": (q, v) => {
    q.language = v;
  },
  "--capability": (q, v) => {
    q.capability = v;
  },
  "--skill": (q, v) => {
    q.skill = v;
  },
  "--card": (q, v) => {
    q.cards = q.cards ?? [];
    q.cards.push(v);
  },
};

function readFlagValue(args: string[], i: number, flag: string): string {
  const v = args[i + 1];
  if (v === undefined) {
    process.stderr.write(`tagen: ${flag} requires a value\n`);
    process.exit(1);
  }
  return v;
}

function parseComposeQuery(args: string[]): ComposeQuery {
  const q: ComposeQuery = {};
  for (let i = 0; i < args.length; i++) {
    const setter = COMPOSE_FLAGS[args[i]];
    if (setter) {
      setter(q, readFlagValue(args, i, args[i]));
      i++;
    }
  }
  return q;
}

/**
 * Validate ComposeQuery values against the controlled vocabulary and capability
 * enum. Per SPEC-tagen, an unknown value exits 1 — silently matching nothing
 * masks user typos.
 */
function validateComposeQuery(
  q: ComposeQuery,
  vocab: Vocabulary,
  capabilities: CapabilityRegistry
): void {
  const errors: string[] = [];
  const check = (dim: string, value: string | undefined, validList: string[]): void => {
    if (value === undefined) return;
    if (!validList.includes(value)) {
      errors.push(`unknown ${dim} value: "${value}" (valid: ${validList.join(", ")})`);
    }
  };
  check("domain", q.domain, getValidValues(vocab, "domain"));
  check("language", q.language, getValidValues(vocab, "language"));
  if (q.capability && !isValidCapability(capabilities, q.capability)) {
    errors.push(
      `unknown capability: "${q.capability}" (valid: ${allCapabilities(capabilities).join(", ")})`
    );
  }
  if (errors.length > 0) {
    for (const e of errors) process.stderr.write(`tagen: ${e}\n`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return;
  }

  const json = args.includes("--json");
  const restArgs = args.slice(1);
  const vaultDir = findVaultDir();

  switch (command) {
    case "tags": {
      const vocab = loadVocabulary(vaultDir);
      runTags(vocab, json);
      break;
    }
    case "list": {
      const cards = loadAllCards(vaultDir);
      const filterIdx = restArgs.indexOf("--filter");
      const filterArg = filterIdx >= 0 ? restArgs[filterIdx + 1] : undefined;
      runList(cards, json, filterArg);
      break;
    }
    case "validate": {
      const vocab = loadVocabulary(vaultDir);
      const cards = loadAllCards(vaultDir);
      const capabilities = loadCapabilities(vaultDir);
      const protocols = loadProtocols(vaultDir);
      const subagents = loadSubagents(vaultDir);
      runValidate(cards, vocab, capabilities, protocols, subagents, repoRoot(vaultDir));
      break;
    }
    case "add": {
      const vocab = loadVocabulary(vaultDir);
      const cards = loadAllCards(vaultDir);
      await runAdd(cards, vocab, vaultDir);
      break;
    }
    case "demo": {
      const vocab = loadVocabulary(vaultDir);
      const capabilities = loadCapabilities(vaultDir);
      const cards = loadAllCards(vaultDir);
      const subagents = loadSubagents(vaultDir);
      const q = parseComposeQuery(restArgs);
      validateComposeQuery(q, vocab, capabilities);
      runDemo(cards, subagents, q);
      break;
    }
    case "get": {
      const vocab = loadVocabulary(vaultDir);
      const capabilities = loadCapabilities(vaultDir);
      const cards = loadAllCards(vaultDir);
      const subagents = loadSubagents(vaultDir);
      const protocols = loadProtocols(vaultDir);
      const root = repoRoot(vaultDir);
      const q = parseComposeQuery(restArgs);
      validateComposeQuery(q, vocab, capabilities);
      runGet(cards, subagents, protocols, root, q, json);
      break;
    }
    default:
      process.stderr.write(
        `Unknown command: ${command}\nRun 'tagen --help' for usage.\n`
      );
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal: ${msg}\n`);
  process.exit(2);
});
