import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  generateMarketplaceJson,
  generatePluginJson,
} from "../lib/build-utils";
import type { BuildConfig } from "../lib/types";
import { repoRoot } from "../lib/vocabulary";

/** Only allow safe characters in plugin/skill names to prevent path traversal and YAML injection */
const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export async function runPluginCreate(
  vaultDir: string,
  args: string[]
): Promise<void> {
  const root = repoRoot(vaultDir);

  const opts = args[0] && !args[0].startsWith("--")
    ? parseFlags(args)
    : await promptInteractive();

  if (!opts.name) {
    process.stderr.write("No plugin name provided.\n");
    process.exit(1);
  }

  if (!SAFE_NAME.test(opts.name)) {
    process.stderr.write(`Invalid plugin name: "${opts.name}". Use only letters, digits, dashes, dots, and underscores.\n`);
    process.exit(1);
  }

  const skillName = opts.skill || opts.name;
  if (!SAFE_NAME.test(skillName)) {
    process.stderr.write(`Invalid skill name: "${skillName}". Use only letters, digits, dashes, dots, and underscores.\n`);
    process.exit(1);
  }

  const pluginDir = join(root, "plugins", opts.name);
  if (existsSync(pluginDir)) {
    process.stderr.write(`Plugin directory already exists: plugins/${opts.name}/\n`);
    process.exit(1);
  }

  const description = opts.description || `${opts.name} plugin`;
  const keywords = opts.keywords;

  const buildYaml = `name: ${opts.name}
version: 1.0.0
description: "${description.replace(/"/g, '\\"')}"
author:
  name: qsm
keywords: [${keywords.map((k) => k.trim()).join(", ")}]

queries: []

include: [${skillName}]
exclude: []
hooks: null
`;
  mkdirSync(pluginDir, { recursive: true });
  writeFileSync(join(pluginDir, "build.yaml"), buildYaml);

  const config: BuildConfig = {
    name: opts.name,
    version: "1.0.0",
    description,
    author: { name: "qsm" },
    keywords,
    queries: [],
    include: [skillName],
    exclude: [],
  };
  const manifestDir = join(pluginDir, ".claude-plugin");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "plugin.json"), generatePluginJson(config));

  const skillDir = join(pluginDir, "skills", skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, "SKILL.md"),
    `---
name: ${skillName}
description: "TODO: Add trigger phrases for this skill"
---

# ${skillName}

TODO: Add Iron Laws, DON'Ts, workflow, and reference file table.
`
  );

  mkdirSync(join(skillDir, "references"), { recursive: true });

  const cardPath = join(vaultDir, "skills", `${skillName}.md`);
  if (!existsSync(cardPath)) {
    writeFileSync(
      cardPath,
      `---
skill: ${skillName}
plugin: ${opts.name}
source: plugins/${opts.name}/skills/${skillName}/SKILL.md
description: "${description.replace(/"/g, '\\"')}"
tags:
  phase: [implementation]
  domain: [tooling]
  language: agnostic
  layer: utility
  concerns: [cli-tooling]
composes: []
enhances: []
---

# ${skillName}

${description}
`
    );
    process.stdout.write(`Created catalog card: skill-graph/skills/${skillName}.md\n`);
  } else {
    process.stdout.write(`Catalog card already exists: skill-graph/skills/${skillName}.md\n`);
  }

  const marketplacePath = join(root, ".claude-plugin", "marketplace.json");
  mkdirSync(join(root, ".claude-plugin"), { recursive: true });
  writeFileSync(marketplacePath, generateMarketplaceJson(root));

  process.stdout.write(`Created plugin: plugins/${opts.name}/\n`);
  process.stdout.write(`  build.yaml, plugin.json, SKILL.md stub, marketplace.json updated.\n`);
}

// ─── Flag parsing ───────────────────────────────────────────────────────────

interface PluginOpts {
  name: string;
  description: string;
  skill: string;
  keywords: string[];
}

function parseFlags(args: string[]): PluginOpts {
  const name = args[0];
  let description = "";
  let skill = "";
  let keywords: string[] = [];

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case "--description":
        description = args[++i] ?? "";
        break;
      case "--skill":
        skill = args[++i] ?? "";
        break;
      case "--keywords":
        keywords = (args[++i] ?? "").split(",").map((k) => k.trim()).filter(Boolean);
        break;
    }
  }

  return { name, description, skill, keywords };
}

// ─── Interactive mode ───────────────────────────────────────────────────────

async function promptInteractive(): Promise<PluginOpts> {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stderr });

  try {
    const name = (await rl.question("Plugin name: ")).trim();
    const skill = (await rl.question(`Skill name [${name}]: `)).trim() || name;
    const description = (await rl.question("Description: ")).trim();
    const kwStr = (await rl.question("Keywords (comma-separated): ")).trim();
    const keywords = kwStr
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    return { name, description, skill, keywords };
  } finally {
    rl.close();
  }
}
