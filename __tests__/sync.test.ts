import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSkillFiles } from "../src/commands/sync.ts";
import { SKILL_GRAPH_FIXTURES, createTempProject, spawnTagen } from "./helpers";

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "tagen-sync-"));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Helper ─────────────────────────────────────────────────────────────────

function writeSkillMd(
  pluginsDir: string,
  plugin: string,
  skill: string,
  name?: string
): void {
  const skillDir = join(pluginsDir, plugin, "skills", skill);
  mkdirSync(skillDir, { recursive: true });
  const frontmatter = name
    ? `---\nname: ${name}\n---\n# ${name}`
    : `---\ndescription: "no name field"\n---\n# ${skill}`;
  writeFileSync(join(skillDir, "SKILL.md"), frontmatter);
}

// ─── discoverSkillFiles ─────────────────────────────────────────────────────

describe("discoverSkillFiles", () => {
  test("returns empty array when pluginsDir does not exist", () => {
    const result = discoverSkillFiles("/nonexistent/plugins");
    expect(result).toEqual([]);
  });

  test("returns empty array when no plugins have skills", () => {
    const dir = mkdtempSync(join(tmpDir, "plugins-"));
    mkdirSync(join(dir, "empty-plugin"), { recursive: true });

    const result = discoverSkillFiles(dir);
    expect(result).toEqual([]);
  });

  test("discovers SKILL.md with frontmatter name field", () => {
    const dir = mkdtempSync(join(tmpDir, "plugins-"));
    writeSkillMd(dir, "test-plugin", "my-skill", "my-skill");

    const result = discoverSkillFiles(dir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("my-skill");
    expect(result[0].plugin).toBe("test-plugin");
    expect(result[0].relativePath).toBe("plugins/test-plugin/skills/my-skill/SKILL.md");
  });

  test("falls back to directory name when frontmatter has no name field", () => {
    const dir = mkdtempSync(join(tmpDir, "plugins-"));
    writeSkillMd(dir, "test-plugin", "dir-name-skill");

    const result = discoverSkillFiles(dir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("dir-name-skill");
  });

  test("skips directories without SKILL.md", () => {
    const dir = mkdtempSync(join(tmpDir, "plugins-"));
    // Skill dir exists but no SKILL.md inside
    mkdirSync(join(dir, "test-plugin", "skills", "empty-skill"), {
      recursive: true,
    });

    const result = discoverSkillFiles(dir);
    expect(result).toEqual([]);
  });

  test("discovers across multiple plugins", () => {
    const dir = mkdtempSync(join(tmpDir, "plugins-"));
    writeSkillMd(dir, "plugin-a", "skill-a", "skill-a");
    writeSkillMd(dir, "plugin-b", "skill-b", "skill-b");

    const result = discoverSkillFiles(dir);
    expect(result).toHaveLength(2);
    const names = result.map((sf) => sf.name).sort();
    expect(names).toEqual(["skill-a", "skill-b"]);
  });
});

// ─── runSync integration (subprocess) ───────────────────────────────────────

describe("tagen sync (integration)", () => {
  test("exits 0 when all SKILL.md files have catalog cards", async () => {
    // Create a fully controlled project: one card + its source file
    const projectDir = mkdtempSync(join(tmpdir(), "tagen-sync-int-"));
    try {
      // Minimal vocabulary
      const sgDir = join(projectDir, "skill-graph");
      mkdirSync(join(sgDir, "skills"), { recursive: true });
      const vocabSrc = join(SKILL_GRAPH_FIXTURES, "vocabulary.yaml");
      writeFileSync(
        join(sgDir, "vocabulary.yaml"),
        readFileSync(vocabSrc, "utf8")
      );

      // Single catalog card pointing to a source that will exist
      writeFileSync(
        join(sgDir, "skills", "my-skill.md"),
        `---
skill: my-skill
plugin: my-plugin
source: plugins/my-plugin/skills/my-skill/SKILL.md
description: "Test skill"
tags:
  phase: [implementation]
  domain: [testing]
  language: agnostic
  layer: methodology
  concerns: [testing]
composes: []
enhances: []
---

# My Skill
`
      );

      // Create the source SKILL.md so it's not orphaned
      const skillDir = join(projectDir, "plugins", "my-plugin", "skills", "my-skill");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "SKILL.md"),
        "---\nname: my-skill\n---\n# My Skill"
      );

      mkdirSync(join(projectDir, ".claude-plugin"), { recursive: true });

      const { exitCode, stdout } = await spawnTagen(["sync"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("No orphans");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("reports missing from graph when SKILL.md has no catalog card", async () => {
    const projectDir = createTempProject({ plugins: ["qsm-methodology"] });
    try {
      // Create a SKILL.md for a skill that has no catalog card
      const skillDir = join(
        projectDir,
        "plugins",
        "qsm-methodology",
        "skills",
        "unregistered"
      );
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "SKILL.md"),
        "---\nname: unregistered\n---\n# Unregistered"
      );

      const { exitCode, stdout } = await spawnTagen(["sync"], projectDir);
      expect(exitCode).toBe(1);
      expect(stdout).toContain("Missing from graph");
      expect(stdout).toContain("unregistered");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("reports orphaned cards when source file does not exist", async () => {
    const projectDir = createTempProject();
    try {
      // The fixture cards (tdd-workflow, ts-tdd, python-bdd) all have source paths
      // pointing to SKILL.md files that don't exist (no plugins built yet).
      // This means they're all orphaned.
      const { exitCode, stdout } = await spawnTagen(["sync"], projectDir);
      expect(exitCode).toBe(1);
      expect(stdout).toContain("Orphaned cards");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
