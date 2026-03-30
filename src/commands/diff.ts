import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  discoverBuildPlugins,
  loadBuildConfig,
  resolveSkills,
} from "../lib/build-utils";
import type { CatalogCard } from "../lib/types";

type DiffStatus = "IN_SYNC" | "STALE" | "MISSING" | "ORPHAN";

interface DiffEntry {
  skill: string;
  status: DiffStatus;
  detail?: string;
}

function findBuiltSkills(pluginDir: string): Set<string> {
  const skillsDir = join(pluginDir, "skills");
  if (!existsSync(skillsDir)) return new Set();
  return new Set(
    readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(skillsDir, d.name, "SKILL.md")))
      .map((d) => d.name)
  );
}

function compareContent(card: CatalogCard, pluginDir: string): DiffEntry {
  const refPath = join(
    pluginDir,
    "skills",
    card.skill,
    "references",
    `${card.skill}.md`
  );
  const skillPath = join(pluginDir, "skills", card.skill, "SKILL.md");

  if (!existsSync(skillPath)) {
    return { skill: card.skill, status: "MISSING" };
  }

  if (!existsSync(refPath)) {
    return {
      skill: card.skill,
      status: "STALE",
      detail: "reference file missing",
    };
  }

  const refContent = readFileSync(refPath, "utf8").trim();
  if (refContent !== card.body.trim()) {
    return {
      skill: card.skill,
      status: "STALE",
      detail: "content differs",
    };
  }

  const skillContent = readFileSync(skillPath, "utf8");
  for (const law of card.ironLaws) {
    if (!skillContent.includes(law)) {
      return {
        skill: card.skill,
        status: "STALE",
        detail: "iron_laws changed",
      };
    }
  }

  return { skill: card.skill, status: "IN_SYNC" };
}

export function runDiff(
  allCards: CatalogCard[],
  root: string,
  pluginName: string | undefined,
  all: boolean
): void {
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
    process.stderr.write("Usage: tagen diff --plugin <name> or tagen diff --all\n");
    process.exit(1);
  }

  let hasIssues = false;

  for (const name of names) {
    const pluginDir = join(pluginsDir, name);
    const config = loadBuildConfig(pluginDir);
    const expected = resolveSkills(config, allCards);
    const built = findBuiltSkills(pluginDir);
    const entries: DiffEntry[] = [];

    for (const card of expected) {
      entries.push(compareContent(card, pluginDir));
      built.delete(card.skill);
    }

    for (const orphan of built) {
      entries.push({ skill: orphan, status: "ORPHAN" });
    }

    process.stdout.write(`\nPlugin: ${config.name}\n\n`);
    for (const entry of entries) {
      const statusIcon =
        entry.status === "IN_SYNC"
          ? "  "
          : entry.status === "STALE"
            ? "* "
            : entry.status === "MISSING"
              ? "! "
              : "? ";
      const detail = entry.detail ? ` (${entry.detail})` : "";
      process.stdout.write(
        `  ${statusIcon}${entry.skill.padEnd(30)} ${entry.status}${detail}\n`
      );
      if (entry.status !== "IN_SYNC") hasIssues = true;
    }
  }

  process.stdout.write("\n");
  if (hasIssues) {
    process.stdout.write("Run 'tagen build --all' to sync.\n");
  } else {
    process.stdout.write("All plugins in sync.\n");
  }
}
