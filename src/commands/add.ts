import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import type { CatalogCard, Vocabulary } from "../lib/types";
import { getValidValues, repoRoot } from "../lib/vocabulary";

export async function runAdd(
  cards: CatalogCard[],
  vocab: Vocabulary,
  vaultDir: string
): Promise<void> {
  const root = repoRoot(vaultDir);
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const name = await ask(rl, "Skill name: ");
    if (!name) return abort("No name provided.");
    if (cards.some((c) => c.skill === name))
      return abort(`Skill "${name}" already exists in graph.`);

    const plugins = discoverPlugins(root);
    process.stdout.write("\nPlugins:\n");
    for (let i = 0; i < plugins.length; i++) {
      process.stdout.write(`  ${i + 1}. ${plugins[i]}\n`);
    }
    const pluginIdx = await ask(rl, `Plugin [1-${plugins.length}]: `);
    const plugin = plugins[Number(pluginIdx) - 1];
    if (!plugin) return abort("Invalid plugin selection.");

    const phase = await askMulti(rl, vocab, "phase");
    const domain = await askMulti(rl, vocab, "domain");
    const language = await askSingle(rl, vocab, "language");
    const layer = await askSingle(rl, vocab, "layer");
    const concerns = await askMulti(rl, vocab, "concerns");

    const existingSkills = cards.map((c) => c.skill);
    const composes = await askSkillRefs(
      rl,
      "Composes (comma-separated, or empty): ",
      existingSkills
    );
    const enhances = await askSkillRefs(
      rl,
      "Enhances (comma-separated, or empty): ",
      existingSkills
    );

    const description = await ask(rl, "One-line description: ");

    const composesYaml = composes.length > 0 ? `[${composes.join(", ")}]` : "[]";
    const enhancesYaml = enhances.length > 0 ? `[${enhances.join(", ")}]` : "[]";

    const linksSection = buildLinksSection(composes, enhances);

    const content = `---
skill: ${name}
plugin: ${plugin}
source: plugins/${plugin}/skills/${name}/SKILL.md
tags:
  phase: [${phase.join(", ")}]
  domain: [${domain.join(", ")}]
  language: ${language}
  layer: ${layer}
  concerns: [${concerns.join(", ")}]
composes: ${composesYaml}
enhances: ${enhancesYaml}
---

# ${name}

${description}
${linksSection}`;

    const cardPath = join(vaultDir, "skills", `${name}.md`);
    writeFileSync(cardPath, content);
    process.stdout.write(`\nCreated: ${cardPath}\n`);

    const skillMdPath = join(root, "plugins", plugin, "skills", name, "SKILL.md");
    if (!existsSync(skillMdPath)) {
      mkdirSync(dirname(skillMdPath), { recursive: true });
      const skillContent = `---
name: ${name}
description: "TODO: Add trigger phrases for this skill"
---

# ${name}

TODO: Add Iron Laws, DON'Ts, workflow, and reference file table.
`;
      writeFileSync(skillMdPath, skillContent);
      process.stdout.write(`Scaffolded: ${skillMdPath}\n`);
    } else {
      process.stdout.write(`SKILL.md already exists: ${skillMdPath}\n`);
    }
  } finally {
    rl.close();
  }
}

function buildLinksSection(composes: string[], enhances: string[]): string {
  const parts: string[] = [];
  if (composes.length > 0) {
    parts.push(`Composes: ${composes.map((s) => `[[${s}]]`).join(" | ")}`);
  }
  if (enhances.length > 0) {
    parts.push(`Enhances: ${enhances.map((s) => `[[${s}]]`).join(" | ")}`);
  }
  if (parts.length === 0) return "";
  return `\n## Links\n${parts.join("\n")}\n`;
}

async function ask(
  rl: ReturnType<typeof createInterface>,
  question: string
): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function askMulti(
  rl: ReturnType<typeof createInterface>,
  vocab: Vocabulary,
  dimension: string
): Promise<string[]> {
  const valid = getValidValues(vocab, dimension);
  process.stdout.write(`\n${dimension}: ${valid.join(", ")}\n`);
  const answer = await ask(rl, `${dimension} (comma-separated): `);
  return answer
    .split(",")
    .map((v) => v.trim())
    .filter((v) => valid.includes(v));
}

async function askSingle(
  rl: ReturnType<typeof createInterface>,
  vocab: Vocabulary,
  dimension: string
): Promise<string> {
  const valid = getValidValues(vocab, dimension);
  process.stdout.write(`\n${dimension}: ${valid.join(", ")}\n`);
  const answer = await ask(rl, `${dimension}: `);
  if (valid.includes(answer)) return answer;
  const fallback = valid[0];
  if (!fallback) {
    process.stderr.write(`  No valid values for dimension "${dimension}"\n`);
    process.exit(1);
  }
  process.stdout.write(`  Invalid "${answer}" — using "${fallback}"\n`);
  return fallback;
}

async function askSkillRefs(
  rl: ReturnType<typeof createInterface>,
  question: string,
  existing: string[]
): Promise<string[]> {
  const answer = await ask(rl, question);
  if (!answer) return [];
  return answer
    .split(",")
    .map((v) => v.trim())
    .filter((v) => existing.includes(v));
}

function discoverPlugins(repoRoot: string): string[] {
  const pluginsDir = join(repoRoot, "plugins");
  try {
    return readdirSync(pluginsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

function abort(msg: string): never {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}
