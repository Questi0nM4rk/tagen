import type { ParsedCommandArgs } from "../cli/args.ts";
import {
  Command,
  type CommandContext,
  DiagnosticCatalogPolicy,
  ForbidPositionalArguments,
} from "../cli/command.ts";
import { BooleanParameter } from "../cli/parameter.ts";
import { CommandResult } from "../cli/result.ts";
import { ROOT_PARAMETER } from "../cli/root.ts";
import type { Card, Protocol } from "../lib/types.ts";
import { validateCards } from "../validation/card-validator.ts";
import { validateHarnessNeutrality } from "../validation/harness-validator.ts";
import { validateProtocols } from "../validation/protocol-validator.ts";

class VerboseParameter extends BooleanParameter<"--verbose"> {
  constructor() {
    super("--verbose", "--verbose", "Per-card per-rule trace");
  }
}

const VERBOSE_PARAMETER = Object.freeze(new VerboseParameter());

export interface ValidateOptions {
  readonly verbose: boolean;
}

export interface ValidationContext {
  readonly cards: readonly Card[];
  readonly protocols: readonly Protocol[];
  /** Absolute marketplace root (parent of brain/). Used to read disk paths. */
  readonly root: string;
  /** Frontmatter parse errors keyed by `<type>/<name>`. */
  readonly frontmatterErrors: ReadonlyMap<string, readonly string[]>;
  /** Catalog-shape errors found before card parsing. */
  readonly catalogErrors: readonly string[];
}

/**
 * Walk every rule, print every violation, never fast-fail. Exits 0 on a clean
 * tree, 1 on any violation. Caller resolves `cards`/`protocols`/`knownTypes`
 * via the catalog loader.
 */
export function runValidate(
  ctx: ValidationContext,
  opts: ValidateOptions
): CommandResult {
  const violations = validateCatalog(ctx);

  if (opts.verbose) {
    process.stderr.write(
      `tagen: scanned ${ctx.cards.length} card(s); ${violations.length} violation(s)\n`
    );
  }

  if (violations.length > 0) {
    process.stderr.write(violations.map((v) => `tagen: ${v}\n`).join(""));
  }

  return violations.length > 0 ? CommandResult.failure(1) : CommandResult.SUCCESS;
}

export class ValidateCommand extends Command<"validate", ValidateOptions> {
  readonly name = "validate";
  readonly summary =
    "Walk the tree and report every rule violation; exit non-zero on any";
  readonly parameters = Object.freeze([VERBOSE_PARAMETER, ROOT_PARAMETER]);
  readonly positionals = Object.freeze(new ForbidPositionalArguments());
  readonly catalog = Object.freeze(new DiagnosticCatalogPolicy(ROOT_PARAMETER));

  protected decode(args: ParsedCommandArgs): ValidateOptions {
    return Object.freeze({ verbose: args.has(VERBOSE_PARAMETER) });
  }

  protected execute(context: CommandContext, options: ValidateOptions): CommandResult {
    return runValidate(context, options);
  }
}

export const validateCommand = Object.freeze(new ValidateCommand());

export function validateCatalog(ctx: ValidationContext): readonly string[] {
  return Object.freeze([
    ...ctx.catalogErrors,
    ...validateCards(ctx.cards, ctx.frontmatterErrors),
    ...validateProtocols(ctx.protocols, ctx.root),
    ...validateHarnessNeutrality(ctx.root),
  ]);
}
