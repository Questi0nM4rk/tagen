import { addCommand } from "./add.ts";
import { getCommand } from "./get.ts";
import { listCommand } from "./list.ts";
import { validateCommand } from "./validate.ts";

const COMMANDS = Object.freeze([
  validateCommand,
  listCommand,
  getCommand,
  addCommand,
] as const);

export type CommandName = (typeof COMMANDS)[number]["name"];
export type RegisteredCommand = (typeof COMMANDS)[number];

export class CommandRegistry {
  readonly commands: readonly RegisteredCommand[];
  readonly #byName: ReadonlyMap<string, RegisteredCommand>;
  readonly #parameterNames: ReadonlySet<string>;

  constructor(commands: readonly RegisteredCommand[]) {
    this.commands = Object.freeze([...commands]);
    this.#byName = new Map(commands.map((command) => [command.name, command]));
    this.#parameterNames = new Set(
      commands.flatMap((command) =>
        command.parameters.map((parameter) => parameter.name)
      )
    );
    Object.freeze(this);
  }

  find(name: string): RegisteredCommand | undefined {
    return this.#byName.get(name);
  }

  hasParameter(name: string): boolean {
    return this.#parameterNames.has(name);
  }
}

export const commandRegistry = new CommandRegistry(COMMANDS);
