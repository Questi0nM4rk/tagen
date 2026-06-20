import { findBrainDir, type LoadResult, resolveBrainDir } from "../lib/catalog.ts";
import type { ParsedCommandArgs } from "./args.ts";
import { fail, failCatalogLoad } from "./errors.ts";
import type { CommandParameter, ValueParameter } from "./parameter.ts";
import type { CommandResult } from "./result.ts";

export interface CommandContext extends LoadResult {
  readonly brainDir: string;
  readonly root: string;
}

export abstract class PositionalArgumentsPolicy {
  abstract validate(commandName: string, values: readonly string[]): void;
}

export class AllowPositionalArguments extends PositionalArgumentsPolicy {
  validate(): void {}
}

export class ForbidPositionalArguments extends PositionalArgumentsPolicy {
  validate(commandName: string, values: readonly string[]): void {
    const first = values[0];
    if (first !== undefined) {
      fail(`unexpected positional argument for '${commandName}': ${first}`);
    }
  }
}

export abstract class CatalogPolicy {
  readonly rootParameter: ValueParameter | undefined;

  constructor(rootParameter?: ValueParameter) {
    this.rootParameter = rootParameter;
  }

  resolveBrainDir(args: ParsedCommandArgs): string {
    const root =
      this.rootParameter === undefined ? undefined : args.value(this.rootParameter);
    return root === undefined ? findBrainDir() : resolveBrainDir(root);
  }

  abstract assertLoadable(result: LoadResult): void;
}

export class CleanCatalogPolicy extends CatalogPolicy {
  assertLoadable(result: LoadResult): void {
    if (result.catalogErrors.length > 0 || result.frontmatterErrors.size > 0) {
      failCatalogLoad(result);
    }
  }
}

export class DiagnosticCatalogPolicy extends CatalogPolicy {
  assertLoadable(): void {}
}

export interface CommandArgumentSpec {
  readonly name: string;
  readonly parameters: readonly CommandParameter[];
  readonly positionals: PositionalArgumentsPolicy;
}

export interface CommandMetadata extends CommandArgumentSpec {
  readonly summary: string;
  readonly catalog: CatalogPolicy;
  readonly positionalHelp: readonly string[];
  run(
    context: CommandContext,
    args: ParsedCommandArgs
  ): CommandResult | Promise<CommandResult>;
}

export abstract class Command<Name extends string, Options> implements CommandMetadata {
  abstract readonly name: Name;
  abstract readonly summary: string;
  abstract readonly parameters: readonly CommandParameter[];
  abstract readonly positionals: PositionalArgumentsPolicy;
  abstract readonly catalog: CatalogPolicy;
  readonly positionalHelp: readonly string[] = Object.freeze([]);

  protected abstract decode(args: ParsedCommandArgs): Options;
  protected abstract execute(
    context: CommandContext,
    options: Options
  ): CommandResult | Promise<CommandResult>;

  run(
    context: CommandContext,
    args: ParsedCommandArgs
  ): CommandResult | Promise<CommandResult> {
    return this.execute(context, this.decode(args));
  }
}
