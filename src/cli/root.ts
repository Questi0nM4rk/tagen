import { valueFlag } from "./command.ts";

export const ROOT_FLAG = valueFlag(
  "--root",
  "--root <dir>",
  "Resolve brain at <dir>/brain instead of walking up from cwd"
);
