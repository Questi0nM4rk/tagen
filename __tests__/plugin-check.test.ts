import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, spawnTagen } from "./helpers";

// ─── tagen plugin check ────────────────────────────────────────────────────

describe("tagen plugin check", () => {
  test("exits 0 when marketplace matches disk", async () => {
    const projectDir = createTempProject({ plugins: ["qsm-methodology"] });
    try {
      // Build to generate marketplace.json
      await spawnTagen(["build", "--all", "--no-bump"], projectDir);

      const { exitCode, stdout } = await spawnTagen(["plugin", "check"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("registered");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("detects orphan plugin (on disk but not in marketplace)", async () => {
    const projectDir = createTempProject({ plugins: ["qsm-methodology"] });
    try {
      // Build to generate marketplace.json
      await spawnTagen(["build", "--all", "--no-bump"], projectDir);

      // Add an unregistered plugin directory (no build.yaml, so it won't be in marketplace)
      const orphanDir = join(projectDir, "plugins", "orphan-plugin");
      mkdirSync(orphanDir, { recursive: true });

      const { exitCode, stdout } = await spawnTagen(["plugin", "check"], projectDir);
      expect(exitCode).toBe(1);
      expect(stdout).toContain("Orphan");
      expect(stdout).toContain("orphan-plugin");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("detects phantom entry (in marketplace but no directory)", async () => {
    const projectDir = createTempProject({ plugins: ["qsm-methodology"] });
    try {
      // Build to generate marketplace.json
      await spawnTagen(["build", "--all", "--no-bump"], projectDir);

      // Add a phantom entry to marketplace.json
      const mpPath = join(projectDir, ".claude-plugin", "marketplace.json");
      const mp = JSON.parse(readFileSync(mpPath, "utf8"));
      mp.plugins.push({
        name: "phantom-plugin",
        source: "./plugins/phantom-plugin",
        description: "Does not exist",
        version: "1.0.0",
        author: { name: "test" },
        keywords: [],
      });
      writeFileSync(mpPath, JSON.stringify(mp, null, 2));

      const { exitCode, stdout } = await spawnTagen(["plugin", "check"], projectDir);
      expect(exitCode).toBe(1);
      expect(stdout).toContain("Phantom");
      expect(stdout).toContain("phantom-plugin");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("exits 1 when marketplace.json is missing", async () => {
    const projectDir = createTempProject();
    try {
      // No build.yaml plugins, no marketplace.json
      const { exitCode, stderr } = await spawnTagen(["plugin", "check"], projectDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("marketplace.json");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("exits 0 when no plugins exist and marketplace is empty", async () => {
    const projectDir = createTempProject();
    try {
      // Write an empty marketplace
      const mpPath = join(projectDir, ".claude-plugin", "marketplace.json");
      writeFileSync(
        mpPath,
        JSON.stringify({
          name: "test",
          description: "test",
          owner: { name: "test" },
          plugins: [],
        })
      );

      const { exitCode, stdout } = await spawnTagen(["plugin", "check"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("registered");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
