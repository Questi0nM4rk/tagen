import { join } from "node:path";
import { loadAgnosticConfig } from "../lib/agnostic-config.ts";
import { builtInRuleIds, findHarnessLeaks } from "../lib/harness-guard.ts";

/** Validate harness neutrality by scanning brain/ for harness-specific leaks. */
export function validateHarnessNeutrality(root: string): readonly string[] {
  const configResult = loadAgnosticConfig(root, builtInRuleIds());
  if (configResult.errors.length > 0) return configResult.errors;

  const brainDir = join(root, "brain");
  return Object.freeze(
    findHarnessLeaks(brainDir, root, configResult.config).map(
      (leak) =>
        `${leak.path}:${leak.line}: harness leak [${leak.ruleId}]: ${leak.token}`
    )
  );
}
