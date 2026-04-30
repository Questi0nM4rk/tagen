import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAdd } from "./commands/add";
import { runDemo } from "./commands/demo";
import { runGet } from "./commands/get";
import { runList, runListSubagents } from "./commands/list";
import { runTags } from "./commands/tags";
import { runValidate } from "./commands/validate";
import {
  allCapabilities,
  isValidCapability,
  loadCapabilities,
} from "./lib/capabilities";
import { loadAllCards } from "./lib/catalog";
import type { ComposeQuery } from "./lib/compose";
import { allProtocolNames, isValidProtocol, loadProtocols } from "./lib/protocols";
import { loadSubagents } from "./lib/subagents";
import type { CapabilityRegistry, ProtocolEntry, Vocabulary } from "./lib/types";
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
  list       List catalog cards (or subagents with --subagents)
  demo       Preview a composition (matched cards + slot fills + warnings)
  get        Resolve a composition into a JSON manifest (--json)
  add        Scaffold a new catalog card interactively

Options (list / demo / get):
  --phase X        Filter by phase (repeatable, OR)
  --domain X       Filter by domain (repeatable, OR)
  --language X     Filter by language (single; matches X OR 'agnostic')
  --layer X        Filter by layer (repeatable, OR)
  --concerns X     Filter by concern (repeatable, OR)
  --capability X   Cards whose 'provides' includes X (repeatable, OR)
  --protocol X     Cards whose 'emits' or 'consumes' includes X (repeatable, OR)
  --json           Machine-readable output

list-only:
  --subagents      List subagents instead of catalog cards

demo / get:
  --card NAME      Restrict matched set to listed cards (repeatable, bypasses
                   tag filters; used to override slot resolution)

demo:
  --verbose        Print resolution trace

get:
  --dry-run        Skip downstream protocol-schema check (no-op today)

validate:
  --verbose        Print per-card per-rule trace

Common:
  --help           Show this help

Examples:
  tagen list
  tagen list --domain code-review --language dotnet
  tagen list --subagents
  tagen tags --json
  tagen demo --domain code-review --language dotnet
  tagen demo --card strict-review --card csharp-patterns
  tagen get --domain code-review --language dotnet --json
  tagen validate --verbose
`;

const REPEAT_FLAGS: Record<string, (q: ComposeQuery) => string[]> = {
  "--phase": (q) => (q.phase ??= []),
  "--domain": (q) => (q.domain ??= []),
  "--layer": (q) => (q.layer ??= []),
  "--concerns": (q) => (q.concerns ??= []),
  "--capability": (q) => (q.capability ??= []),
  "--protocol": (q) => (q.protocol ??= []),
  "--card": (q) => (q.cards ??= []),
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
    const flag = args[i];
    if (flag === "--language") {
      q.language = readFlagValue(args, i, flag);
      i++;
      continue;
    }
    const bucket = REPEAT_FLAGS[flag];
    if (bucket) {
      bucket(q).push(readFlagValue(args, i, flag));
      i++;
    }
  }
  return q;
}

function validateComposeQuery(
  q: ComposeQuery,
  vocab: Vocabulary,
  capabilities: CapabilityRegistry,
  protocols: ProtocolEntry[]
): void {
  const errors: string[] = [];
  const checkAll = (
    dim: string,
    values: string[] | undefined,
    valid: string[]
  ): void => {
    if (!values?.length) return;
    for (const v of values) {
      if (!valid.includes(v)) {
        errors.push(`unknown ${dim} value: "${v}" (valid: ${valid.join(", ")})`);
      }
    }
  };
  checkAll("phase", q.phase, getValidValues(vocab, "phase"));
  checkAll("domain", q.domain, getValidValues(vocab, "domain"));
  checkAll("layer", q.layer, getValidValues(vocab, "layer"));
  checkAll("concerns", q.concerns, getValidValues(vocab, "concerns"));
  if (q.language && !getValidValues(vocab, "language").includes(q.language)) {
    errors.push(
      `unknown language value: "${q.language}" (valid: ${getValidValues(vocab, "language").join(", ")})`
    );
  }
  if (q.capability?.length) {
    for (const cap of q.capability) {
      if (!isValidCapability(capabilities, cap)) {
        errors.push(
          `unknown capability: "${cap}" (valid: ${allCapabilities(capabilities).join(", ")})`
        );
      }
    }
  }
  if (q.protocol?.length) {
    const validProtos = allProtocolNames(protocols);
    for (const p of q.protocol) {
      if (!isValidProtocol(protocols, p)) {
        errors.push(`unknown protocol: "${p}" (valid: ${validProtos.join(", ")})`);
      }
    }
  }
  if (errors.length > 0) {
    for (const e of errors) process.stderr.write(`tagen: ${e}\n`);
    process.exit(1);
  }
}

const KNOWN_COMMANDS = new Set(["tags", "validate", "list", "demo", "get", "add"]);

/**
 * Read the bundled package.json's version field. Resolves relative to this
 * compiled file so it works for both `bun run src/main.ts` and the bundled
 * `bin/tagen.js` distribution.
 */
function readBundledVersion(): string {
  const pkgPath = join(import.meta.dir, "..", "package.json");
  const raw = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? "unknown";
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

  const json = args.includes("--json");
  const verbose = args.includes("--verbose");
  const restArgs = args.slice(1);
  const vaultDir = findVaultDir();

  switch (command) {
    case "tags": {
      const vocab = loadVocabulary(vaultDir);
      const capabilities = loadCapabilities(vaultDir);
      const protocols = loadProtocols(vaultDir);
      const subagents = loadSubagents(vaultDir);
      runTags(vocab, capabilities, protocols, subagents, json);
      break;
    }
    case "list": {
      const vocab = loadVocabulary(vaultDir);
      const capabilities = loadCapabilities(vaultDir);
      const protocols = loadProtocols(vaultDir);
      if (restArgs.includes("--subagents")) {
        runListSubagents(loadSubagents(vaultDir), { json });
        break;
      }
      const cards = loadAllCards(vaultDir);
      const q = parseComposeQuery(restArgs);
      validateComposeQuery(q, vocab, capabilities, protocols);
      runList(cards, q, { json });
      break;
    }
    case "validate": {
      const vocab = loadVocabulary(vaultDir);
      const cards = loadAllCards(vaultDir);
      const capabilities = loadCapabilities(vaultDir);
      const protocols = loadProtocols(vaultDir);
      const subagents = loadSubagents(vaultDir);
      runValidate(
        cards,
        vocab,
        capabilities,
        protocols,
        subagents,
        repoRoot(vaultDir),
        { verbose }
      );
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
      const protocols = loadProtocols(vaultDir);
      const q = parseComposeQuery(restArgs);
      validateComposeQuery(q, vocab, capabilities, protocols);
      runDemo(cards, subagents, q, { verbose });
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
      validateComposeQuery(q, vocab, capabilities, protocols);
      const dryRun = restArgs.includes("--dry-run");
      runGet(cards, subagents, protocols, root, q, { json, dryRun });
      break;
    }
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal: ${msg}\n`);
  process.exit(2);
});
