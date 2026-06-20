import { describe, expect, test } from "bun:test";
import { parseCommandArgs } from "../src/cli/args.ts";
import {
  AllowPositionalArguments,
  ForbidPositionalArguments,
} from "../src/cli/command.ts";
import {
  BooleanParameter,
  RepeatableValueParameter,
  ValueParameter,
} from "../src/cli/parameter.ts";

class TypeParameter extends ValueParameter<"--type"> {
  constructor() {
    super("--type", "--type T", "type");
  }
}

class PinParameter extends RepeatableValueParameter<"--pin"> {
  constructor() {
    super("--pin", "--pin T=N", "pin");
  }
}

class JsonParameter extends BooleanParameter<"--json"> {
  constructor() {
    super("--json", "--json", "json");
  }
}

const TYPE_PARAMETER = new TypeParameter();
const PIN_PARAMETER = new PinParameter();
const JSON_PARAMETER = new JsonParameter();
const KNOWN_FLAGS = new Set(["--type", "--pin", "--json"]);
const isKnownFlag = (name: string): boolean => KNOWN_FLAGS.has(name);

describe("parseCommandArgs", () => {
  test("rejects an unknown option", () => {
    expect(() =>
      parseCommandArgs(
        ["--bogus"],
        {
          name: "example",
          parameters: [],
          positionals: new AllowPositionalArguments(),
        },
        isKnownFlag
      )
    ).toThrow("unknown option: --bogus");
  });

  test("rejects a value flag with no value", () => {
    expect(() =>
      parseCommandArgs(
        ["--type"],
        {
          name: "example",
          parameters: [TYPE_PARAMETER],
          positionals: new AllowPositionalArguments(),
        },
        isKnownFlag
      )
    ).toThrow("--type requires a value");
  });

  test("rejects a repeated non-repeatable flag", () => {
    expect(() =>
      parseCommandArgs(
        ["--type", "lang", "--type", "review"],
        {
          name: "example",
          parameters: [TYPE_PARAMETER],
          positionals: new AllowPositionalArguments(),
        },
        isKnownFlag
      )
    ).toThrow("--type may not be repeated");
  });

  test("preserves every value for a repeatable flag", () => {
    const parsed = parseCommandArgs(
      ["--pin", "lang=rust", "--pin", "review=strict"],
      {
        name: "example",
        parameters: [PIN_PARAMETER],
        positionals: new AllowPositionalArguments(),
      },
      isKnownFlag
    );
    expect(parsed.values(PIN_PARAMETER)).toEqual(["lang=rust", "review=strict"]);
    expect(Object.isFrozen(parsed.values(PIN_PARAMETER))).toBe(true);
    expect(Object.isFrozen(parsed.positional)).toBe(true);
  });

  test("rejects positional arguments when forbidden", () => {
    expect(() =>
      parseCommandArgs(
        ["ignored"],
        {
          name: "example",
          parameters: [JSON_PARAMETER],
          positionals: new ForbidPositionalArguments(),
        },
        isKnownFlag
      )
    ).toThrow("unexpected positional argument for 'example': ignored");
  });
});
