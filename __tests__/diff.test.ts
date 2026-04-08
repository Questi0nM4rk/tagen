import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compareContent,
  findBuiltSkills,
} from "../src/commands/diff.ts";
import {
  createTempProject,
  makeCard,
  spawnTagen,
} from "./helpers";

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "tagen-diff-"));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── findBuiltSkills ────────────────────────────────────────────────────────

describe("findBuiltSkills", () => {
  test("returns empty set when pluginDir has no skills/ directory", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    const result = findBuiltSkills(dir);
    expect(result.size).toBe(0);
  });

  test("returns skill names from dirs containing SKILL.md", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    const fooDir = join(dir, "skills", "foo");
    const barDir = join(dir, "skills", "bar");
    mkdirSync(fooDir, { recursive: true });
    mkdirSync(barDir, { recursive: true });
    writeFileSync(join(fooDir, "SKILL.md"), "# Foo");
    writeFileSync(join(barDir, "SKILL.md"), "# Bar");

    const result = findBuiltSkills(dir);
    expect(result.has("foo")).toBe(true);
    expect(result.has("bar")).toBe(true);
    expect(result.size).toBe(2);
  });

  test("ignores dirs without SKILL.md", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    const withFile = join(dir, "skills", "has-skill");
    const withoutFile = join(dir, "skills", "no-skill");
    mkdirSync(withFile, { recursive: true });
    mkdirSync(withoutFile, { recursive: true });
    writeFileSync(join(withFile, "SKILL.md"), "# Has");

    const result = findBuiltSkills(dir);
    expect(result.has("has-skill")).toBe(true);
    expect(result.has("no-skill")).toBe(false);
  });
});

// ─── compareContent ─────────────────────────────────────────────────────────

describe("compareContent", () => {
  test("returns MISSING when SKILL.md does not exist", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    const card = makeCard({ skill: "missing" });

    const result = compareContent(card, dir);
    expect(result.status).toBe("MISSING");
    expect(result.skill).toBe("missing");
  });

  test("returns STALE with 'reference file missing' when SKILL.md exists but reference does not", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    const skillDir = join(dir, "skills", "test-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# Test");

    const card = makeCard();
    const result = compareContent(card, dir);
    expect(result.status).toBe("STALE");
    expect(result.detail).toContain("reference file missing");
  });

  test("returns STALE with 'content differs' when reference content does not match card body", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    const card = makeCard();
    const skillDir = join(dir, "skills", card.skill);
    const refsDir = join(skillDir, "references");
    mkdirSync(refsDir, { recursive: true });

    writeFileSync(join(skillDir, "SKILL.md"), card.ironLaws.join("\n"));
    writeFileSync(join(refsDir, `${card.skill}.md`), "Different content");

    const result = compareContent(card, dir);
    expect(result.status).toBe("STALE");
    expect(result.detail).toContain("content differs");
  });

  test("returns STALE with 'iron_laws changed' when iron laws missing from SKILL.md", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    const card = makeCard();
    const skillDir = join(dir, "skills", card.skill);
    const refsDir = join(skillDir, "references");
    mkdirSync(refsDir, { recursive: true });

    // Reference matches body
    writeFileSync(join(refsDir, `${card.skill}.md`), card.body);
    // SKILL.md missing the iron laws
    writeFileSync(join(skillDir, "SKILL.md"), "# No iron laws here");

    const result = compareContent(card, dir);
    expect(result.status).toBe("STALE");
    expect(result.detail).toContain("iron_laws changed");
  });

  test("returns IN_SYNC when everything matches", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    const card = makeCard();
    const skillDir = join(dir, "skills", card.skill);
    const refsDir = join(skillDir, "references");
    mkdirSync(refsDir, { recursive: true });

    // Reference matches body
    writeFileSync(join(refsDir, `${card.skill}.md`), card.body);
    // SKILL.md contains all iron laws
    const skillContent = `# Test\n\n${card.ironLaws.join("\n")}`;
    writeFileSync(join(skillDir, "SKILL.md"), skillContent);

    const result = compareContent(card, dir);
    expect(result.status).toBe("IN_SYNC");
  });

  test("returns IN_SYNC when card has no iron_laws", () => {
    const dir = mkdtempSync(join(tmpDir, "plugin-"));
    const card = makeCard({ ironLaws: [] });
    const skillDir = join(dir, "skills", card.skill);
    const refsDir = join(skillDir, "references");
    mkdirSync(refsDir, { recursive: true });

    writeFileSync(join(refsDir, `${card.skill}.md`), card.body);
    writeFileSync(join(skillDir, "SKILL.md"), "# Anything");

    const result = compareContent(card, dir);
    expect(result.status).toBe("IN_SYNC");
  });
});

// ─── runDiff integration (subprocess) ───────────────────────────────────────

describe("tagen diff (integration)", () => {
  test("exits 1 with usage message when no --plugin or --all", async () => {
    const projectDir = createTempProject({ plugins: ["qsm-methodology"] });
    try {
      const { exitCode, stderr } = await spawnTagen(["diff"], projectDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Usage");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("exits 0 when plugin is in sync after build", async () => {
    const projectDir = createTempProject({ plugins: ["qsm-methodology"] });
    try {
      // Build first to create the plugin output
      await spawnTagen(["build", "--plugin", "qsm-methodology", "--no-bump"], projectDir);
      // Diff should show in sync
      const { exitCode, stdout } = await spawnTagen(["diff", "--plugin", "qsm-methodology"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("All plugins in sync");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("exits 1 when content is stale", async () => {
    const projectDir = createTempProject({ plugins: ["qsm-methodology"] });
    try {
      // Build first
      await spawnTagen(["build", "--plugin", "qsm-methodology", "--no-bump"], projectDir);

      // Modify the catalog card body to make content stale
      const cardPath = join(projectDir, "skill-graph", "skills", "tdd-workflow.md");
      const original = readFileSync(cardPath, "utf8");
      writeFileSync(cardPath, `${original}\n\nExtra content that makes it stale.`);

      const { exitCode, stdout } = await spawnTagen(["diff", "--plugin", "qsm-methodology"], projectDir);
      expect(exitCode).toBe(1);
      expect(stdout).toContain("STALE");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("reports ORPHAN for skills on disk not in build config", async () => {
    const projectDir = createTempProject({ plugins: ["qsm-methodology"] });
    try {
      // Build first
      await spawnTagen(["build", "--plugin", "qsm-methodology", "--no-bump"], projectDir);

      // Manually create an orphan skill directory
      const orphanDir = join(projectDir, "plugins", "qsm-methodology", "skills", "orphan-skill");
      mkdirSync(orphanDir, { recursive: true });
      writeFileSync(join(orphanDir, "SKILL.md"), "---\nname: orphan\n---\n# Orphan");

      const { exitCode, stdout } = await spawnTagen(["diff", "--plugin", "qsm-methodology"], projectDir);
      expect(exitCode).toBe(1);
      expect(stdout).toContain("ORPHAN");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("--all discovers and diffs all plugins", async () => {
    const projectDir = createTempProject({
      plugins: ["qsm-methodology", "qsm-typescript-lang"],
    });
    try {
      await spawnTagen(["build", "--all", "--no-bump"], projectDir);
      const { exitCode, stdout } = await spawnTagen(["diff", "--all"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("qsm-methodology");
      expect(stdout).toContain("qsm-typescript-lang");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
