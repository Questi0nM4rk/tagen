import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runSearch, TEXT_RESULT_CAP } from "../src/commands/search.ts";
import { loadAllCards, marketplaceRoot } from "../src/lib/catalog.ts";
import type { Card } from "../src/lib/types.ts";
import { SearchQuery, searchCards } from "../src/search/index.ts";
import { textWords, wordMatchesToken } from "../src/search/match.ts";
import { captureBoth, captureStdout } from "./helpers/capture.ts";

const BRAIN = join(import.meta.dir, "fixtures", "brain");
const ROOT = marketplaceRoot(BRAIN);
const { cards } = loadAllCards(BRAIN);

/** Minimal in-memory card whose only searchable text is its CORE body. */
function syntheticCard(type: string, name: string, body: string): Card {
  return Object.freeze({
    id: Object.freeze({ type, name }),
    dirPath: join(ROOT, "brain", type, name),
    corePath: join(ROOT, "brain", type, name, "CORE.md"),
    frontmatter: Object.freeze({ description: "synthetic" }),
    body,
    references: Object.freeze([]),
    validators: Object.freeze([]),
  });
}

describe("SearchQuery", () => {
  test("lowercases, splits on whitespace, and dedupes tokens", () => {
    const q = new SearchQuery(["Async  REVIEW", "review"]);
    expect(q.tokens).toEqual(["async", "review"]);
  });

  test("rejects an empty query", () => {
    expect(() => new SearchQuery(["   "])).toThrow();
  });
});

describe("wordMatchesToken", () => {
  test("substring match at any token length", () => {
    expect(wordMatchesToken("reviewer", "review")).toBe(true);
    expect(wordMatchesToken("bun-test", "tes")).toBe(true);
  });

  test("Levenshtein distance 1 matches for tokens of length >= 4", () => {
    expect(wordMatchesToken("worktree", "workree")).toBe(true);
    expect(wordMatchesToken("isolation", "isolaton")).toBe(true);
  });

  test("Levenshtein distance 2 does not match", () => {
    expect(wordMatchesToken("asyncio", "asynch")).toBe(false);
  });

  test("tokens shorter than 4 chars are substring-only", () => {
    expect(wordMatchesToken("tdt", "tdd")).toBe(false);
    expect(wordMatchesToken("tdd-loop", "tdd")).toBe(true);
  });
});

describe("textWords", () => {
  test("lowercases and splits on non-word separators, keeping hyphens", () => {
    expect(textWords("Async/await in bun-test.")).toEqual([
      "async",
      "await",
      "in",
      "bun-test",
    ]);
  });
});

describe("searchCards — canonical fixture", () => {
  test("typo'd query finds the card via a reference file", () => {
    const results = searchCards(cards, ROOT, new SearchQuery(["asynch"]));
    const csharp = results.find((r) => r.id.type === "lang" && r.id.name === "csharp");
    expect(csharp).toBeDefined();
    expect(csharp?.files[0]?.path).toBe("references/async.md");
  });

  test("distinct tokens matched outranks raw match count", () => {
    const results = searchCards(cards, ROOT, new SearchQuery(["review", "async"]));
    const first = results[0];
    expect(first?.id).toEqual({ type: "lang", name: "csharp" });
    expect(first?.tokensMatched).toBe(2);
    expect(first?.tokensTotal).toBe(2);
  });

  test("frontmatter is not searched", () => {
    // "zero-tolerance" appears only in review/strict's description frontmatter.
    const results = searchCards(cards, ROOT, new SearchQuery(["zero-tolerance"]));
    expect(results).toEqual([]);
  });

  test("ties rank by total matches, then type/name alphabetically", () => {
    const results = searchCards(cards, ROOT, new SearchQuery(["review"]));
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1];
      const curr = results[i];
      if (!prev || !curr) throw new Error("missing result");
      expect(prev.matches).toBeGreaterThanOrEqual(curr.matches);
      if (prev.matches === curr.matches) {
        const prevKey = `${prev.id.type}/${prev.id.name}`;
        const currKey = `${curr.id.type}/${curr.id.name}`;
        expect(prevKey.localeCompare(currKey)).toBeLessThan(0);
      }
    }
  });
});

describe("runSearch — text mode", () => {
  test("prints ranked rows and a result-count footer", () => {
    const { stdout } = captureBoth(() =>
      runSearch(cards, ROOT, { terms: ["review", "async"], json: false })
    );
    const lines = stdout.trim().split("\n");
    expect(lines[0]).toContain("lang/csharp");
    expect(lines[0]).toContain("2/2 tokens");
    expect(lines[0]).toContain("references/async.md");
    expect(lines.at(-1)).toMatch(/^\d+ card\(s\) matched\.$/);
  });

  test("zero results: friendly stderr and exit 1", () => {
    let exitCode = 0;
    const { stdout, stderr } = captureBoth(() => {
      exitCode = runSearch(cards, ROOT, {
        terms: ["zzzznonsense"],
        json: false,
      }).exitCode;
    });
    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("no cards match");
  });

  test("--type restricts the search to one card type", () => {
    const { stdout } = captureBoth(() =>
      runSearch(cards, ROOT, { terms: ["review"], json: false, type: "subagent" })
    );
    expect(stdout).toContain("subagent/security-reviewer");
    expect(stdout).not.toContain("lang/");
  });

  test(`caps text output at ${TEXT_RESULT_CAP} cards with an overflow line`, () => {
    const many = Array.from({ length: TEXT_RESULT_CAP + 5 }, (_, i) =>
      syntheticCard("lang", `card-${String(i).padStart(2, "0")}`, "shared keyword\n")
    );
    const { stdout } = captureBoth(() =>
      runSearch(many, ROOT, { terms: ["keyword"], json: false })
    );
    const lines = stdout.trim().split("\n");
    expect(lines.filter((l) => l.startsWith("lang/")).length).toBe(TEXT_RESULT_CAP);
    expect(stdout).toContain("… and 5 more");
    expect(stdout).toContain(`${TEXT_RESULT_CAP + 5} card(s) matched.`);
  });
});

describe("runSearch — JSON mode", () => {
  test("emits all results with per-file match counts", () => {
    const stdout = captureStdout(() => {
      runSearch(cards, ROOT, { terms: ["review", "async"], json: true });
    });
    const parsed = JSON.parse(stdout) as Array<{
      type: string;
      name: string;
      tokensMatched: number;
      tokensTotal: number;
      matches: number;
      files: Array<{ path: string; matches: number }>;
    }>;
    expect(parsed[0]?.type).toBe("lang");
    expect(parsed[0]?.name).toBe("csharp");
    expect(parsed[0]?.tokensMatched).toBe(2);
    expect(parsed[0]?.tokensTotal).toBe(2);
    expect(parsed[0]?.matches).toBeGreaterThan(0);
    expect(parsed[0]?.files.length).toBeGreaterThan(0);
    for (const entry of parsed) {
      expect(entry.files.reduce((sum, f) => sum + f.matches, 0)).toBe(entry.matches);
    }
  });

  test("JSON mode is uncapped", () => {
    const many = Array.from({ length: TEXT_RESULT_CAP + 5 }, (_, i) =>
      syntheticCard("lang", `card-${String(i).padStart(2, "0")}`, "shared keyword\n")
    );
    const stdout = captureStdout(() => {
      runSearch(many, ROOT, { terms: ["keyword"], json: true });
    });
    const parsed = JSON.parse(stdout) as unknown[];
    expect(parsed.length).toBe(TEXT_RESULT_CAP + 5);
  });
});
