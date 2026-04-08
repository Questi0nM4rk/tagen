import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { BuildConfig, BuildQuery, CatalogCard, Marketplace } from "./types";

export function loadBuildConfig(pluginDir: string): BuildConfig {
  const configPath = join(pluginDir, "build.yaml");
  if (!existsSync(configPath)) {
    throw new Error(`No build.yaml found in ${pluginDir}`);
  }
  const raw = readFileSync(configPath, "utf8");
  const parsed = parseYaml(raw) as Record<string, unknown>;

  return {
    name: String(parsed.name ?? ""),
    version: String(parsed.version ?? "0.0.0"),
    description: String(parsed.description ?? ""),
    author: (parsed.author as { name: string }) ?? { name: "qsm" },
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
    queries: Array.isArray(parsed.queries) ? (parsed.queries as BuildQuery[]) : [],
    include: Array.isArray(parsed.include) ? parsed.include.map(String) : [],
    exclude: Array.isArray(parsed.exclude) ? parsed.exclude.map(String) : [],
    hooks: typeof parsed.hooks === "string" ? parsed.hooks : undefined,
  };
}

function getArrayDimension(card: CatalogCard, dim: string): string[] {
  switch (dim) {
    case "phase":
      return card.tags.phase;
    case "domain":
      return card.tags.domain;
    case "concerns":
      return card.tags.concerns;
    case "layer":
      return [card.tags.layer];
    default:
      return [];
  }
}

/**
 * Strict language filter for build queries.
 * Unlike tagen resolve (which includes agnostic skills for any language),
 * tagen build uses exact matching — language: python only matches python, not agnostic.
 */
export function strictFilterCards(
  cards: CatalogCard[],
  filters: Record<string, string[]>
): CatalogCard[] {
  return cards.filter((card) => {
    for (const [dim, filterValues] of Object.entries(filters)) {
      if (filterValues.length === 0) continue;

      if (dim === "language") {
        if (!filterValues.includes(card.tags.language)) {
          return false;
        }
      } else {
        const cardValues = getArrayDimension(card, dim);
        if (!filterValues.some((fv) => cardValues.includes(fv))) {
          return false;
        }
      }
    }
    return true;
  });
}

export function resolveSkills(
  config: BuildConfig,
  allCards: CatalogCard[]
): CatalogCard[] {
  const matched = new Map<string, CatalogCard>();

  for (const query of config.queries) {
    const filters: Record<string, string[]> = {};
    if (query.tags) {
      for (const [dim, val] of Object.entries(query.tags)) {
        filters[dim] = Array.isArray(val) ? val.map(String) : [String(val)];
      }
    }
    for (const card of strictFilterCards(allCards, filters)) {
      matched.set(card.skill, card);
    }
  }

  for (const name of config.include) {
    const card = allCards.find((c) => c.skill === name);
    if (card) matched.set(card.skill, card);
  }

  for (const name of config.exclude) {
    matched.delete(name);
  }

  return Array.from(matched.values());
}

export function discoverBuildPlugins(pluginsDir: string): string[] {
  if (!existsSync(pluginsDir)) return [];
  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter(
      (d) => d.isDirectory() && existsSync(join(pluginsDir, d.name, "build.yaml"))
    )
    .map((d) => d.name);
}

/** SHA-256 of sorted skill bodies — deterministic content fingerprint */
export function computeContentHash(skills: CatalogCard[]): string {
  const sorted = [...skills].sort((a, b) => a.skill.localeCompare(b.skill));
  const content = sorted.map((s) => s.body).join("\n---\n");
  return createHash("sha256").update(content).digest("hex");
}

/** Read stored .build-hash, or null if first build */
export function readBuildHash(pluginDir: string): string | null {
  const hashPath = join(pluginDir, ".build-hash");
  if (!existsSync(hashPath)) return null;
  return readFileSync(hashPath, "utf8").trim();
}

/** Write .build-hash */
export function writeBuildHash(pluginDir: string, hash: string): void {
  writeFileSync(join(pluginDir, ".build-hash"), `${hash}\n`);
}

export type BumpType = "patch" | "minor" | "major";

/** Bump version by type: patch (1.0.0→1.0.1), minor (1.0.0→1.1.0), major (1.0.0→2.0.0) */
export function bumpVersion(version: string, type: BumpType): string {
  const parts = version.split(".");
  if (parts.length !== 3) return version;
  const [major, minor, patch] = parts.map((p) => Number.parseInt(p, 10));
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

/** Prompt user for bump type via stdin. Returns chosen type or null if skipped. */
export async function promptBumpType(
  pluginName: string,
  currentVersion: string
): Promise<BumpType | null> {
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stderr });

  const patchV = bumpVersion(currentVersion, "patch");
  const minorV = bumpVersion(currentVersion, "minor");
  const majorV = bumpVersion(currentVersion, "major");

  process.stderr.write(
    `\n  ${pluginName} v${currentVersion} has content changes.\n` +
      `    [p] patch → ${patchV}  (default — content fix, no new skills)\n` +
      `    [m] minor → ${minorV}  (new skills or features)\n` +
      `    [M] major → ${majorV}  (breaking changes)\n` +
      `    [s] skip  (no version bump)\n` +
      `  Choice [p/m/M/s]: `
  );

  return new Promise((resolve) => {
    rl.question("", (answer) => {
      rl.close();
      const raw = answer.trim();
      const lower = raw.toLowerCase();
      if (lower === "s" || lower === "skip") resolve(null);
      else if (raw === "M" || lower === "major") resolve("major");
      else if (lower === "m" || lower === "minor") resolve("minor");
      else resolve("patch"); // default
    });
  });
}

/** String-replace version line in build.yaml — preserves formatting */
export function updateBuildYamlVersion(pluginDir: string, newVersion: string): void {
  const configPath = join(pluginDir, "build.yaml");
  const raw = readFileSync(configPath, "utf8");
  const updated = raw.replace(/^version:\s*.+$/m, `version: ${newVersion}`);
  if (updated === raw) {
    throw new Error(`updateBuildYamlVersion: no version line found in ${configPath}`);
  }
  writeFileSync(configPath, updated);
}

/** Discover ALL plugin directories (not just those with build.yaml) */
export function discoverAllPlugins(pluginsDir: string): string[] {
  if (!existsSync(pluginsDir)) return [];
  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/** Load and parse .claude-plugin/marketplace.json, or null if missing */
export function loadMarketplace(root: string): Marketplace | null {
  const manifestPath = join(root, ".claude-plugin", "marketplace.json");
  if (!existsSync(manifestPath)) return null;
  const raw = readFileSync(manifestPath, "utf8");
  return JSON.parse(raw) as Marketplace;
}

/**
 * Extract plugin directory name from marketplace source path.
 * source is "./plugins/<name>" — returns the directory name.
 */
export function pluginNameFromSource(source: string): string {
  const parts = source.replace(/^\.\//, "").split("/");
  return parts[1] ?? "";
}

/**
 * Compare plugin directories on disk against marketplace.json entries.
 * Returns orphans (on disk, not in manifest) and phantoms (in manifest, not on disk).
 */
export function findOrphansAndPhantoms(root: string): {
  orphans: string[];
  phantoms: string[];
} {
  const pluginsDir = join(root, "plugins");
  const onDisk = new Set(discoverAllPlugins(pluginsDir));
  const marketplace = loadMarketplace(root);
  if (!marketplace) return { orphans: [], phantoms: [] };

  const inManifest = new Set(
    marketplace.plugins.map((p) => pluginNameFromSource(p.source))
  );

  const orphans = [...onDisk].filter((name) => !inManifest.has(name));
  const phantoms = [...inManifest].filter((name) => !onDisk.has(name));
  return { orphans, phantoms };
}

/** Generate plugin.json manifest content from a BuildConfig */
export function generatePluginJson(config: BuildConfig): string {
  const manifest: Record<string, unknown> = {
    name: config.name,
    version: config.version,
    description: config.description,
    author: config.author,
    keywords: config.keywords,
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** Generate marketplace.json from all build.yaml files */
export function generateMarketplaceJson(root: string): string {
  const pluginsDir = join(root, "plugins");
  const names = discoverBuildPlugins(pluginsDir);

  const plugins = names.map((name) => {
    const config = loadBuildConfig(join(pluginsDir, name));
    return {
      name: config.name,
      source: `./plugins/${name}`,
      description: config.description,
      version: config.version,
      author: config.author,
      keywords: config.keywords,
    };
  });

  const manifest = {
    name: "qsm-marketplace",
    description:
      "Personal Claude Code plugin marketplace. Skill-graph-driven architecture — content lives in tagged catalog cards, plugins assembled via tagen build.",
    owner: { name: "qsm" },
    plugins,
  };

  return `${JSON.stringify(manifest, null, 2)}\n`;
}
