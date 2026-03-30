import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  bumpVersion,
  computeContentHash,
  discoverBuildPlugins,
  generateMarketplaceJson,
  loadBuildConfig,
  promptBumpType,
  readBuildHash,
  resolveSkills,
  updateBuildYamlVersion,
  writeBuildHash,
} from "../lib/build-utils";
import type { BuildConfig, CatalogCard } from "../lib/types";

const ACRONYMS = new Set([
  "tdd",
  "bdd",
  "ddd",
  "api",
  "di",
  "oom",
  "ef",
  "pr",
  "cli",
  "ci",
  "dto",
  "orm",
  "sql",
  "ui",
  "ux",
  "qa",
  "sdk",
]);

function titleCase(s: string): string {
  return s
    .split(/[-_]/)
    .map((w) =>
      ACRONYMS.has(w.toLowerCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(" ");
}

function uniqueTags(card: CatalogCard): string {
  const all = [...card.tags.domain, ...card.tags.concerns.slice(0, 2)];
  return [...new Set(all)].join(", ");
}

function generateSkillMd(card: CatalogCard): string {
  const lines: string[] = [];

  lines.push("---");
  lines.push(`name: ${card.skill}`);
  lines.push(`description: "${card.description.replace(/"/g, '\\"')}"`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${titleCase(card.skill)}`);
  lines.push("");

  if (card.ironLaws.length > 0) {
    lines.push("## Iron Laws");
    for (const [i, law] of card.ironLaws.entries()) {
      lines.push(`${i + 1}. ${law}`);
    }
    lines.push("");
  }

  lines.push("## References");
  lines.push("| File | Tags | Load When |");
  lines.push("|------|------|-----------|");
  lines.push(
    `| references/${card.skill}.md | ${uniqueTags(card)} | Full methodology with WHY rationale and DON'Ts |`
  );
  lines.push("");

  return lines.join("\n");
}

function generatePluginJson(config: BuildConfig): string {
  // hooks are auto-discovered by CC from hooks/hooks.json — never emit in manifest
  const manifest: Record<string, unknown> = {
    name: config.name,
    version: config.version,
    description: config.description,
    author: config.author,
    keywords: config.keywords,
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function writePlugin(
  config: BuildConfig,
  skills: CatalogCard[],
  pluginDir: string
): void {
  const manifestDir = join(pluginDir, ".claude-plugin");
  ensureDir(manifestDir);
  writeFileSync(join(manifestDir, "plugin.json"), generatePluginJson(config));

  for (const card of skills) {
    const skillDir = join(pluginDir, "skills", card.skill);
    const refsDir = join(skillDir, "references");
    ensureDir(refsDir);

    writeFileSync(join(skillDir, "SKILL.md"), generateSkillMd(card));
    writeFileSync(join(refsDir, `${card.skill}.md`), `${card.body}\n`);
  }
}

export async function runBuild(
  allCards: CatalogCard[],
  root: string,
  pluginName: string | undefined,
  all: boolean,
  noBump: boolean
): Promise<void> {
  const pluginsDir = join(root, "plugins");
  const names: string[] = [];

  if (all) {
    names.push(...discoverBuildPlugins(pluginsDir));
    if (names.length === 0) {
      process.stderr.write("No plugins with build.yaml found.\n");
      process.exit(1);
    }
  } else if (pluginName) {
    names.push(pluginName);
  } else {
    process.stderr.write("Usage: tagen build --plugin <name> or tagen build --all\n");
    process.exit(1);
  }

  let totalSkills = 0;
  let bumped = 0;

  for (const name of names) {
    const pluginDir = join(pluginsDir, name);
    let config = loadBuildConfig(pluginDir);
    const skills = resolveSkills(config, allCards);

    const newHash = computeContentHash(skills);
    const oldHash = readBuildHash(pluginDir);
    let versionNote = "";

    if (!noBump && oldHash !== null && oldHash !== newHash) {
      const bumpType = await promptBumpType(config.name, config.version);
      if (bumpType) {
        const newVersion = bumpVersion(config.version, bumpType);
        updateBuildYamlVersion(pluginDir, newVersion);
        config = loadBuildConfig(pluginDir);
        versionNote = ` (${bumpType} → ${config.version})`;
        bumped++;
      } else {
        versionNote = " (changed, skip bump)";
      }
    }

    writePlugin(config, skills, pluginDir);
    writeBuildHash(pluginDir, newHash);
    totalSkills += skills.length;

    process.stdout.write(
      `  ${config.name} v${config.version}: ${skills.length} skill(s)${versionNote}\n`
    );
    for (const s of skills) {
      process.stdout.write(`    ${s.skill} [${s.tags.layer}]\n`);
    }
  }

  const manifestPath = join(root, ".claude-plugin", "marketplace.json");
  writeFileSync(manifestPath, generateMarketplaceJson(root));

  process.stdout.write(
    `\nBuilt ${names.length} plugin(s), ${totalSkills} skill(s) total.`
  );
  if (bumped > 0) {
    process.stdout.write(` ${bumped} version(s) bumped.`);
  }
  process.stdout.write(" marketplace.json updated.\n");
}
