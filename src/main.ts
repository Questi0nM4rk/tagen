import packageJson from "../package.json" with { type: "json" };
import { parseCommandArgs } from "./cli/args.ts";
import type { CommandDescriptor } from "./cli/command.ts";
import { failCatalogLoad, isCliFailure, reportCliFailure } from "./cli/errors.ts";
import { commands, findCommand, knownFlagNames } from "./commands/index.ts";
import {
  findBrainDir,
  loadAllCards,
  marketplaceRoot,
  resolveBrainDir,
} from "./lib/catalog.ts";
import { errorMessage } from "./lib/errors.ts";

function usage(): string {
  const commandWidth = Math.max(...commands.map((command) => command.name.length));
  const commandLines = commands
    .map((command) => `  ${command.name.padEnd(commandWidth)}  ${command.summary}`)
    .join("\n");
  const commandHelp = commands.map(formatCommandHelp).join("\n");

  return `tagen — read-only CLI for a brain/ directory of typed cards

Usage: tagen <command> [options]

Commands:
${commandLines}

${commandHelp}
Common:
  --help / -h       Show this help
  --version / -V    Print version
`;
}

function formatCommandHelp(command: CommandDescriptor<string, unknown>): string {
  const lines = [`${command.name}:`];
  lines.push(...(command.positionalHelp ?? []).map((line) => `  ${line}`));
  for (const flag of command.flags) {
    lines.push(`  ${flag.usage.padEnd(20)} ${flag.description}`);
  }
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const commandName = args[0];

  if (!commandName || commandName === "--help" || commandName === "-h") {
    process.stdout.write(usage());
    return;
  }
  if (commandName === "--version" || commandName === "-V") {
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }

  const command = findCommand(commandName);
  if (!command) {
    process.stderr.write(
      `Unknown command: ${commandName}\nRun 'tagen --help' for usage.\n`
    );
    process.exit(1);
  }

  const parsed = parseCommandArgs(args.slice(1), command, knownFlagNames);
  const rootOverride = command.catalog.rootFlag
    ? parsed.value(command.catalog.rootFlag)
    : undefined;
  const brainDir =
    rootOverride === undefined ? findBrainDir() : resolveBrainDir(rootOverride);
  const root = marketplaceRoot(brainDir);
  const catalog = loadAllCards(brainDir);
  if (
    command.catalog.policy === "clean" &&
    (catalog.catalogErrors.length > 0 || catalog.frontmatterErrors.size > 0)
  ) {
    failCatalogLoad(catalog);
  }

  await command.run({ ...catalog, brainDir, root }, parsed);
}

main().catch((error: unknown) => {
  if (isCliFailure(error)) {
    reportCliFailure(error);
    process.exit(1);
  }
  process.stderr.write(`Fatal: ${errorMessage(error)}\n`);
  process.exit(2);
});
