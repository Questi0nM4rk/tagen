import type { CommandFlag, ParsedCommandArgs, PositionalPolicy } from "./command.ts";
import { fail } from "./errors.ts";

export interface CommandArgSpec {
  readonly name: string;
  readonly flags: readonly CommandFlag[];
  readonly positional: PositionalPolicy;
}

export function parseCommandArgs(
  argv: readonly string[],
  command: CommandArgSpec,
  knownFlagNames: ReadonlySet<string>
): ParsedCommandArgs {
  const positional: string[] = [];
  const values = new Map<string, string[]>();
  const booleans = new Set<string>();

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === undefined) continue;

    const flag = findFlag(command.flags, argument);
    if (flag?.kind === "boolean") {
      if (booleans.has(flag.name)) fail(`${flag.name} may not be repeated`);
      booleans.add(flag.name);
      continue;
    }
    if (flag?.kind === "value") {
      const existing = values.get(flag.name);
      if (!flag.repeatable && existing !== undefined) {
        fail(`${flag.name} may not be repeated`);
      }
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        fail(`${flag.name} requires a value`);
      }
      values.set(flag.name, [...(existing ?? []), value]);
      index++;
      continue;
    }
    if (argument.startsWith("-")) {
      if (knownFlagNames.has(argument)) {
        fail(`${argument} is not valid for '${command.name}'`);
      }
      fail(`unknown option: ${argument}`);
    }
    positional.push(argument);
  }

  if (command.positional === "forbid" && positional.length > 0) {
    fail(`unexpected positional argument for '${command.name}': ${positional[0]}`);
  }

  return {
    positional,
    value(flag) {
      return values.get(flag.name)?.[0];
    },
    values(flag) {
      return values.get(flag.name) ?? [];
    },
    has(flag) {
      return booleans.has(flag.name);
    },
  };
}

function findFlag(
  flags: readonly CommandFlag[],
  name: string
): CommandFlag | undefined {
  return flags.find((flag) => flag.name === name);
}
