import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { CapabilityRegistry } from "./types";

/**
 * Load capability vocabulary from skill-graph/capabilities.yaml.
 *
 * Format (both accepted):
 *
 *   capabilities:
 *     review-methodology: "Process for reviewing code / PRs / MRs"
 *     language-patterns: "Language-specific patterns, idioms, and conventions"
 *
 * OR a flat list:
 *
 *   capabilities:
 *     - review-methodology
 *     - language-patterns
 *
 * If the file is missing, returns an empty registry. Missing file is not an
 * error at load time — `validate` reports it as a warning if any card uses
 * the `provides` / `requires` / slot fields.
 */
export function loadCapabilities(vaultDir: string): CapabilityRegistry {
  const path = join(vaultDir, "capabilities.yaml");
  if (!existsSync(path)) {
    return { capabilities: {} };
  }

  const raw = readFileSync(path, "utf8");
  const parsed = parseYaml(raw) as unknown;
  const capabilities: Record<string, string> = {};

  if (parsed && typeof parsed === "object" && "capabilities" in parsed) {
    const caps = (parsed as { capabilities: unknown }).capabilities;
    if (Array.isArray(caps)) {
      for (const c of caps) {
        if (typeof c === "string") capabilities[c] = "";
      }
    } else if (caps && typeof caps === "object") {
      for (const [k, v] of Object.entries(caps)) {
        capabilities[k] = typeof v === "string" ? v : "";
      }
    }
  }

  return { capabilities };
}

export function isValidCapability(registry: CapabilityRegistry, name: string): boolean {
  return name in registry.capabilities;
}

export function allCapabilities(registry: CapabilityRegistry): string[] {
  return Object.keys(registry.capabilities).sort();
}
