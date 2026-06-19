import { addCommand } from "./add.ts";
import { getCommand } from "./get.ts";
import { listCommand } from "./list.ts";
import { validateCommand } from "./validate.ts";

export const commands = [validateCommand, listCommand, getCommand, addCommand] as const;

export type CommandName = (typeof commands)[number]["name"];
export type RegisteredCommand = (typeof commands)[number];

export const knownFlagNames: ReadonlySet<string> = new Set(
  commands.flatMap((command) => command.flags.map((flag) => flag.name))
);

export function findCommand(name: string): RegisteredCommand | undefined {
  return commands.find((command) => command.name === name);
}
