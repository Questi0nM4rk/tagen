import type { LoadResult } from "../lib/catalog.ts";

export type CatalogPolicy = "clean" | "diagnostic";
export type PositionalPolicy = "allow" | "forbid";

export interface ValueFlag<
  Name extends string = string,
  Repeatable extends boolean = boolean,
> {
  readonly name: Name;
  readonly kind: "value";
  readonly repeatable: Repeatable;
  readonly usage: string;
  readonly description: string;
}

export interface BooleanFlag<Name extends string = string> {
  readonly name: Name;
  readonly kind: "boolean";
  readonly usage: string;
  readonly description: string;
}

export type CommandFlag = ValueFlag | BooleanFlag;

export interface ParsedCommandArgs {
  readonly positional: readonly string[];
  value<Name extends string>(flag: ValueFlag<Name, false>): string | undefined;
  values<Name extends string>(flag: ValueFlag<Name, true>): readonly string[];
  has<Name extends string>(flag: BooleanFlag<Name>): boolean;
}

export interface CommandContext extends LoadResult {
  readonly brainDir: string;
  readonly root: string;
}

interface CommandDefinition<Name extends string, Options> {
  readonly name: Name;
  readonly summary: string;
  readonly flags: readonly CommandFlag[];
  readonly positional: PositionalPolicy;
  readonly positionalHelp?: readonly string[];
  readonly catalog: CatalogPolicy;
  decode(args: ParsedCommandArgs): Options;
  execute(context: CommandContext, options: Options): void | Promise<void>;
}

export interface CommandDescriptor<Name extends string, Options>
  extends CommandDefinition<Name, Options> {
  run(context: CommandContext, args: ParsedCommandArgs): void | Promise<void>;
}

export function defineCommand<Name extends string, Options>(
  definition: CommandDefinition<Name, Options>
): CommandDescriptor<Name, Options> {
  return {
    ...definition,
    run(context, args) {
      return definition.execute(context, definition.decode(args));
    },
  };
}

export function valueFlag<Name extends string>(
  name: Name,
  usage: string,
  description: string
): ValueFlag<Name, false> {
  return { name, kind: "value", repeatable: false, usage, description };
}

export function repeatableValueFlag<Name extends string>(
  name: Name,
  usage: string,
  description: string
): ValueFlag<Name, true> {
  return { name, kind: "value", repeatable: true, usage, description };
}

export function booleanFlag<Name extends string>(
  name: Name,
  usage: string,
  description: string
): BooleanFlag<Name> {
  return { name, kind: "boolean", usage, description };
}
