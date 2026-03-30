import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { sourceExists } from "../lib/catalog";
import type { CatalogCard } from "../lib/types";
import { repoRoot } from "../lib/vocabulary";

interface SkillFile {
  name: string;
  plugin: string;
  relativePath: string;
}

export function runSync(cards: CatalogCard[], vaultDir: string): void {
  const root = repoRoot(vaultDir);
  const pluginsDir = join(root, "plugins");
  const skillFiles = discoverSkillFiles(pluginsDir);
  const catalogSkills = new Set(cards.map((c) => c.skill));

  let issues = 0;

  const missing = skillFiles.filter((sf) => !catalogSkills.has(sf.name));
  if (missing.length > 0) {
    process.stdout.write(`\nMissing from graph (${missing.length}):\n`);
    for (const sf of missing) {
      process.stdout.write(`  ${sf.name.padEnd(26)} ${sf.relativePath}\n`);
      process.stdout.write(
        `    → tagen add (or create skill-graph/skills/${sf.name}.md)\n`
      );
    }
    issues += missing.length;
  }

  const orphaned = cards.filter((c) => !sourceExists(c, root));
  if (orphaned.length > 0) {
    process.stdout.write(`\nOrphaned cards (${orphaned.length}):\n`);
    for (const c of orphaned) {
      process.stdout.write(`  ${c.skill.padEnd(26)} source missing: ${c.source}\n`);
    }
    issues += orphaned.length;
  }

  if (issues === 0) {
    process.stdout.write(
      `All ${skillFiles.length} SKILL.md file(s) have catalog cards. No orphans.\n`
    );
  } else {
    process.stdout.write(`\n${issues} issue(s) found.\n`);
    process.exit(1);
  }
}

function discoverSkillFiles(pluginsDir: string): SkillFile[] {
  const results: SkillFile[] = [];

  let plugins: string[];
  try {
    plugins = readdirSync(pluginsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return results;
  }

  for (const plugin of plugins) {
    const skillsDir = join(pluginsDir, plugin, "skills");
    let skills: string[];
    try {
      skills = readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      continue;
    }

    for (const skill of skills) {
      const skillMd = join(skillsDir, skill, "SKILL.md");
      try {
        const raw = readFileSync(skillMd, "utf8");
        const parts = raw.split("---");
        if (parts.length >= 3) {
          const frontmatter = parseYaml(parts[1]) as Record<string, unknown>;
          const name = String(frontmatter.name ?? skill);
          results.push({
            name,
            plugin,
            relativePath: `plugins/${plugin}/skills/${skill}/SKILL.md`,
          });
        }
      } catch {
        // No SKILL.md or invalid — skip
      }
    }
  }

  return results;
}
