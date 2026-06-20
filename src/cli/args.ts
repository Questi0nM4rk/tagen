import type { CommandArgumentSpec } from "./command.ts";
import { fail } from "./errors.ts";
import {
  BooleanParameter,
  type CommandParameter,
  RepeatableValueParameter,
  ValueParameter,
} from "./parameter.ts";

export class ParsedCommandArgs {
  readonly positional: readonly string[];
  readonly #values: ReadonlyMap<CommandParameter, readonly string[]>;
  readonly #booleans: ReadonlySet<BooleanParameter>;

  constructor(
    positional: readonly string[],
    values: ReadonlyMap<CommandParameter, readonly string[]>,
    booleans: ReadonlySet<BooleanParameter>
  ) {
    this.positional = Object.freeze([...positional]);
    this.#values = new Map(
      [...values].map(([parameter, items]) => [parameter, Object.freeze([...items])])
    );
    this.#booleans = new Set(booleans);
  }

  value<Name extends string>(parameter: ValueParameter<Name>): string | undefined {
    return this.#values.get(parameter)?.[0];
  }

  values<Name extends string>(
    parameter: RepeatableValueParameter<Name>
  ): readonly string[] {
    return this.#values.get(parameter) ?? [];
  }

  has<Name extends string>(parameter: BooleanParameter<Name>): boolean {
    return this.#booleans.has(parameter);
  }
}

export function parseCommandArgs(
  argv: readonly string[],
  command: CommandArgumentSpec,
  isKnownParameter: (name: string) => boolean
): ParsedCommandArgs {
  const positional: string[] = [];
  const values = new Map<CommandParameter, readonly string[]>();
  const booleans = new Set<BooleanParameter>();

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === undefined) continue;

    const parameter = command.parameters.find((item) => item.name === argument);
    if (parameter instanceof BooleanParameter) {
      if (booleans.has(parameter)) fail(`${parameter.name} may not be repeated`);
      booleans.add(parameter);
      continue;
    }
    if (
      parameter instanceof ValueParameter ||
      parameter instanceof RepeatableValueParameter
    ) {
      const existing = values.get(parameter);
      if (parameter instanceof ValueParameter && existing !== undefined) {
        fail(`${parameter.name} may not be repeated`);
      }
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        fail(`${parameter.name} requires a value`);
      }
      values.set(parameter, [...(existing ?? []), value]);
      index++;
      continue;
    }
    if (argument.startsWith("-")) {
      if (isKnownParameter(argument)) {
        fail(`${argument} is not valid for '${command.name}'`);
      }
      fail(`unknown option: ${argument}`);
    }
    positional.push(argument);
  }

  command.positionals.validate(command.name, positional);

  return new ParsedCommandArgs(positional, values, booleans);
}
