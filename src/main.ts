import packageJson from "../package.json" with { type: "json" };
import { parseCommandArgs } from "./cli/args.ts";
import type { CommandMetadata } from "./cli/command.ts";
import { isCliFailure, reportCliFailure } from "./cli/errors.ts";
import { commandRegistry } from "./commands/index.ts";
import { loadAllCards, marketplaceRoot } from "./lib/catalog.ts";
import { errorMessage } from "./lib/errors.ts";

function usage(): string {
  const { commands } = commandRegistry;
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

function formatCommandHelp(command: CommandMetadata): string {
  const lines = [`${command.name}:`];
  lines.push(...(command.positionalHelp ?? []).map((line) => `  ${line}`));
  for (const parameter of command.parameters) {
    lines.push(`  ${parameter.usage.padEnd(20)} ${parameter.description}`);
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

  const command = commandRegistry.find(commandName);
  if (!command) {
    process.stderr.write(
      `Unknown command: ${commandName}\nRun 'tagen --help' for usage.\n`
    );
    process.exitCode = 1;
    return;
  }

  const parsed = parseCommandArgs(args.slice(1), command, (name) =>
    commandRegistry.hasParameter(name)
  );
  const brainDir = command.catalog.resolveBrainDir(parsed);
  const root = marketplaceRoot(brainDir);
  const catalog = loadAllCards(brainDir);
  command.catalog.assertLoadable(catalog);

  const result = await command.run({ ...catalog, brainDir, root }, parsed);
  result.apply();
}

main().catch((error: unknown) => {
  if (isCliFailure(error)) {
    reportCliFailure(error);
    process.exitCode = 1;
    return;
  }
  process.stderr.write(`Fatal: ${errorMessage(error)}\n`);
  process.exitCode = 2;
});
