import { describe, expect, test } from "bun:test";
import { commands } from "../src/commands/index.ts";

describe("command registry", () => {
  test("command names are unique", () => {
    const names = commands.map((command) => command.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("every command contributes help metadata", () => {
    for (const command of commands) {
      expect(command.name.length).toBeGreaterThan(0);
      expect(command.summary.length).toBeGreaterThan(0);
      for (const flag of command.flags) {
        expect(flag.usage.length).toBeGreaterThan(0);
        expect(flag.description.length).toBeGreaterThan(0);
      }
    }
  });
});
