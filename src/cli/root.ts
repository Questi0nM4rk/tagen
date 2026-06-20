import { ValueParameter } from "./parameter.ts";

export class RootParameter extends ValueParameter<"--root"> {
  constructor() {
    super(
      "--root",
      "--root <dir>",
      "Resolve brain at <dir>/brain instead of walking up from cwd"
    );
  }
}

export const ROOT_PARAMETER = Object.freeze(new RootParameter());
