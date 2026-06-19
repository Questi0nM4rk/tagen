import { describe, expect, test } from "bun:test";
import { parseCommandArgs } from "../src/cli/args.ts";
import { booleanFlag, repeatableValueFlag, valueFlag } from "../src/cli/command.ts";

const TYPE_FLAG = valueFlag("--type", "--type T", "type");
const PIN_FLAG = repeatableValueFlag("--pin", "--pin T=N", "pin");
const JSON_FLAG = booleanFlag("--json", "--json", "json");
const KNOWN_FLAGS = new Set(["--type", "--pin", "--json"]);

describe("parseCommandArgs", () => {
  test("rejects an unknown option", () => {
    expect(() =>
      parseCommandArgs(
        ["--bogus"],
        { name: "example", flags: [], positional: "allow" },
        KNOWN_FLAGS
      )
    ).toThrow("unknown option: --bogus");
  });

  test("rejects a value flag with no value", () => {
    expect(() =>
      parseCommandArgs(
        ["--type"],
        { name: "example", flags: [TYPE_FLAG], positional: "allow" },
        KNOWN_FLAGS
      )
    ).toThrow("--type requires a value");
  });

  test("rejects a repeated non-repeatable flag", () => {
    expect(() =>
      parseCommandArgs(
        ["--type", "lang", "--type", "review"],
        { name: "example", flags: [TYPE_FLAG], positional: "allow" },
        KNOWN_FLAGS
      )
    ).toThrow("--type may not be repeated");
  });

  test("preserves every value for a repeatable flag", () => {
    const parsed = parseCommandArgs(
      ["--pin", "lang=rust", "--pin", "review=strict"],
      { name: "example", flags: [PIN_FLAG], positional: "allow" },
      KNOWN_FLAGS
    );
    expect(parsed.values(PIN_FLAG)).toEqual(["lang=rust", "review=strict"]);
  });

  test("rejects positional arguments when forbidden", () => {
    expect(() =>
      parseCommandArgs(
        ["ignored"],
        { name: "example", flags: [JSON_FLAG], positional: "forbid" },
        KNOWN_FLAGS
      )
    ).toThrow("unexpected positional argument for 'example': ignored");
  });
});
