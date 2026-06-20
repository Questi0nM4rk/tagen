import { describe, expect, test } from "bun:test";
import { commandRegistry } from "../src/commands/index.ts";

describe("command registry", () => {
  test("command names are unique", () => {
    const { commands } = commandRegistry;
    const names = commands.map((command) => command.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("every command contributes help metadata", () => {
    expect(Object.isFrozen(commandRegistry)).toBe(true);
    expect(Object.isFrozen(commandRegistry.commands)).toBe(true);
    for (const command of commandRegistry.commands) {
      expect(Object.isFrozen(command)).toBe(true);
      expect(Object.isFrozen(command.parameters)).toBe(true);
      expect(Object.isFrozen(command.positionals)).toBe(true);
      expect(Object.isFrozen(command.catalog)).toBe(true);
      expect(command.name.length).toBeGreaterThan(0);
      expect(command.summary.length).toBeGreaterThan(0);
      for (const parameter of command.parameters) {
        expect(Object.isFrozen(parameter)).toBe(true);
        expect(parameter.usage.length).toBeGreaterThan(0);
        expect(parameter.description.length).toBeGreaterThan(0);
      }
    }
  });

  test("owns command lookup and known-parameter lookup", () => {
    expect(commandRegistry.find("get")?.name).toBe("get");
    expect(commandRegistry.find("missing")).toBeUndefined();
    expect(commandRegistry.hasParameter("--root")).toBe(true);
    expect(commandRegistry.hasParameter("--missing")).toBe(false);
  });
});
