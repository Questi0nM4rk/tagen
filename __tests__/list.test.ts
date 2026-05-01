import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runList } from "../src/commands/list.ts";
import { loadAllCards } from "../src/lib/catalog.ts";
import { captureStdout } from "./helpers/capture.ts";

const BRAIN = join(import.meta.dir, "fixtures", "brain");
const { cards } = loadAllCards(BRAIN);

describe("runList — text mode", () => {
  test("lists every card as <type>/<name>", () => {
    const out = captureStdout(() => runList(cards, { json: false, aliases: false }));
    expect(out).toContain("lang/csharp\n");
    expect(out).toContain("review/strict\n");
    expect(out).toContain("subagent/security-reviewer\n");
  });

  test("--type restricts to one type", () => {
    const out = captureStdout(() =>
      runList(cards, { json: false, type: "lang", aliases: false })
    );
    const lines = out.trim().split("\n").sort();
    expect(lines).toEqual(["lang/csharp", "lang/python", "lang/rust"]);
  });

  test("--aliases appends parenthesised alias list", () => {
    const out = captureStdout(() => runList(cards, { json: false, aliases: true }));
    expect(out).toContain("lang/csharp  (dotnet)");
    expect(out).toContain("lang/python\n");
  });
});

describe("runList — JSON mode", () => {
  test("emits {type, name} entries", () => {
    const out = captureStdout(() => runList(cards, { json: true, aliases: false }));
    const parsed = JSON.parse(out) as Array<{ type: string; name: string }>;
    expect(parsed.find((e) => e.type === "lang" && e.name === "csharp")).toBeDefined();
    expect(parsed[0]).toHaveProperty("type");
    expect(parsed[0]).toHaveProperty("name");
    expect(parsed[0]).not.toHaveProperty("aliases");
  });

  test("--aliases adds aliases array per entry", () => {
    const out = captureStdout(() => runList(cards, { json: true, aliases: true }));
    const parsed = JSON.parse(out) as Array<{
      type: string;
      name: string;
      aliases: string[];
    }>;
    const csharp = parsed.find((e) => e.type === "lang" && e.name === "csharp");
    expect(csharp?.aliases).toEqual(["dotnet"]);
    const python = parsed.find((e) => e.type === "lang" && e.name === "python");
    expect(python?.aliases).toEqual([]);
  });
});
