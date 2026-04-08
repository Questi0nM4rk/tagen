import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, spawnTagen } from "./helpers";

// ─── tagen plugin create (flag-driven) ─────────────────────────────────────

describe("tagen plugin create", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempProject();
  });

  afterAll(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  test("creates plugin directory structure", async () => {
    const { exitCode, stdout } = await spawnTagen(
      [
        "plugin",
        "create",
        "test-plugin",
        "--description",
        "A test plugin",
        "--skill",
        "test-skill",
        "--keywords",
        "test,demo",
      ],
      projectDir
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Created plugin: plugins/test-plugin/");
  });

  test("creates build.yaml with include list", () => {
    const buildYaml = readFileSync(
      join(projectDir, "plugins", "test-plugin", "build.yaml"),
      "utf8"
    );
    expect(buildYaml).toContain("name: test-plugin");
    expect(buildYaml).toContain("include: [test-skill]");
    expect(buildYaml).toContain("version: 1.0.0");
  });

  test("creates plugin.json", () => {
    const pluginJson = JSON.parse(
      readFileSync(
        join(projectDir, "plugins", "test-plugin", ".claude-plugin", "plugin.json"),
        "utf8"
      )
    );
    expect(pluginJson.name).toBe("test-plugin");
    expect(pluginJson.version).toBe("1.0.0");
    expect(pluginJson.description).toBe("A test plugin");
    expect(pluginJson.keywords).toContain("test");
    expect(pluginJson.keywords).toContain("demo");
  });

  test("creates SKILL.md stub", () => {
    const skillMd = readFileSync(
      join(projectDir, "plugins", "test-plugin", "skills", "test-skill", "SKILL.md"),
      "utf8"
    );
    expect(skillMd).toContain("name: test-skill");
    expect(skillMd).toContain("TODO");
  });

  test("creates references directory", () => {
    expect(
      existsSync(
        join(projectDir, "plugins", "test-plugin", "skills", "test-skill", "references")
      )
    ).toBe(true);
  });

  test("creates catalog card in skill-graph/skills/", () => {
    const card = readFileSync(
      join(projectDir, "skill-graph", "skills", "test-skill.md"),
      "utf8"
    );
    expect(card).toContain("skill: test-skill");
    expect(card).toContain("plugin: test-plugin");
    expect(card).toContain("source: plugins/test-plugin/skills/test-skill/SKILL.md");
  });

  test("updates marketplace.json", () => {
    const marketplace = JSON.parse(
      readFileSync(join(projectDir, ".claude-plugin", "marketplace.json"), "utf8")
    );
    const entry = marketplace.plugins.find(
      (p: { name: string }) => p.name === "test-plugin"
    );
    expect(entry).toBeDefined();
    expect(entry.source).toBe("./plugins/test-plugin");
  });

  test("aborts if plugin already exists", async () => {
    const { exitCode, stderr } = await spawnTagen(
      ["plugin", "create", "test-plugin", "--description", "Duplicate"],
      projectDir
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("already exists");
  });
});

// ─── Defaults ───────────────────────────────────────────────────────────────

describe("tagen plugin create (defaults)", () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = createTempProject();
  });

  afterAll(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  test("defaults skill name to plugin name when --skill omitted", async () => {
    const { exitCode } = await spawnTagen(
      ["plugin", "create", "auto-skill", "--description", "Auto"],
      projectDir
    );
    expect(exitCode).toBe(0);

    // SKILL.md named after the plugin
    expect(
      existsSync(
        join(projectDir, "plugins", "auto-skill", "skills", "auto-skill", "SKILL.md")
      )
    ).toBe(true);

    // Catalog card named after the plugin
    expect(existsSync(join(projectDir, "skill-graph", "skills", "auto-skill.md"))).toBe(
      true
    );
  });
});
