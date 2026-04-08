import { runAdd } from "./commands/add";
import { runBuild } from "./commands/build";
import { runDiff } from "./commands/diff";
import { runList } from "./commands/list";
import { runPluginCheck } from "./commands/plugin-check";
import { runPluginCreate } from "./commands/plugin-create";
import { runResolve } from "./commands/resolve";
import { runSync } from "./commands/sync";
import { runTags } from "./commands/tags";
import { runValidate } from "./commands/validate";
import { loadAllCards } from "./lib/catalog";
import { findVaultDir, loadVocabulary, repoRoot } from "./lib/vocabulary";

const USAGE = `tagen — skill graph CLI for qsm-marketplace

Usage: tagen <command> [options]

Commands:
  list              List all skills with their tags
  tags              Show controlled vocabulary
  resolve           Find skills matching tag filters and return ordered path
  validate          Check consistency of all catalog cards + marketplace
  sync              Find SKILL.md files missing from the graph
  add               Scaffold a new catalog card interactively
  build             Assemble plugins from catalog cards via build.yaml tag queries
  diff              Check if built plugins are in sync with catalog card content
  plugin create     Scaffold a new plugin with all required files
  plugin check      Validate marketplace.json consistency

Options:
  --help        Show this help
  --json        Output in JSON format (list, resolve, tags)
  --filter      Filter list by dimension=value (e.g. --filter layer=orchestrator)
  --expand      Include composed skills in resolve output
  --plugin      Target a specific plugin (build, diff)
  --all         Target all plugins with build.yaml (build, diff)
  --description Plugin/skill description (plugin create)
  --skill       Skill name, defaults to plugin name (plugin create)
  --keywords    Comma-separated keywords (plugin create)

Examples:
  tagen list
  tagen list --filter language=dotnet
  tagen tags --json
  tagen resolve --phase design --language dotnet --domain architecture
  tagen resolve --phase implementation --language dotnet --expand
  tagen validate
  tagen sync
  tagen add
  tagen build --plugin methodology
  tagen build --all
  tagen diff --all
  tagen plugin create my-plugin --description "My plugin" --skill my-skill
  tagen plugin check
`;

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
      const filterArg = restArgs.find((_, i) => restArgs[i - 1] === "--filter");
      runList(cards, json, filterArg);
      break;
    }
    case "resolve": {
      const vocab = loadVocabulary(vaultDir);
      const cards = loadAllCards(vaultDir);
      runResolve(cards, vocab, restArgs, json);
      break;
    }
    case "validate": {
      const vocab = loadVocabulary(vaultDir);
      const cards = loadAllCards(vaultDir);
      runValidate(cards, vocab, repoRoot(vaultDir));
      break;
    }
    case "sync": {
      const cards = loadAllCards(vaultDir);
      runSync(cards, vaultDir);
      break;
    }
    case "add": {
      const vocab = loadVocabulary(vaultDir);
      const cards = loadAllCards(vaultDir);
      await runAdd(cards, vocab, vaultDir);
      break;
    }
    case "build": {
      const cards = loadAllCards(vaultDir);
      const root = repoRoot(vaultDir);
      const pluginIdx = restArgs.indexOf("--plugin");
      const pluginArg = pluginIdx >= 0 ? restArgs[pluginIdx + 1] : undefined;
      const all = args.includes("--all");
      const noBump = args.includes("--no-bump");
      await runBuild(cards, root, pluginArg, all, noBump);
      break;
    }
    case "diff": {
      const cards = loadAllCards(vaultDir);
      const root = repoRoot(vaultDir);
      const pluginIdx = restArgs.indexOf("--plugin");
      const pluginArg = pluginIdx >= 0 ? restArgs[pluginIdx + 1] : undefined;
      const all = args.includes("--all");
      runDiff(cards, root, pluginArg, all);
      break;
    }
    case "plugin": {
      const subCommand = args[1];
      switch (subCommand) {
        case "create": {
          await runPluginCreate(vaultDir, args.slice(2));
          break;
        }
        case "check": {
          const root = repoRoot(vaultDir);
          runPluginCheck(root);
          break;
        }
        default:
          process.stderr.write(
            `Unknown plugin subcommand: ${subCommand ?? "(none)"}\nUsage: tagen plugin <create|check>\n`
          );
          process.exit(1);
      }
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
