import { describe, expect, test } from "bun:test";
import { bodyLineCount, parseCore } from "../src/lib/frontmatter.ts";

const wrap = (yaml: string, body = "# Body\n"): string => `---\n${yaml}\n---\n${body}`;

describe("parseCore — frontmatter", () => {
  test("parses minimal valid card", () => {
    const r = parseCore(wrap(`description: "ok"`), "lang");
    expect(r.errors).toEqual([]);
    expect(r.frontmatter.description).toBe("ok");
    expect(r.body).toContain("# Body");
  });

  test("missing frontmatter → error", () => {
    const r = parseCore("# No frontmatter here\n", "lang");
    expect(r.errors[0]).toContain("missing YAML frontmatter");
  });

  test("missing description → error", () => {
    const r = parseCore(wrap(`aliases: [x]`), "lang");
    expect(
      r.errors.some((e) =>
        e.includes("missing required frontmatter field: description")
      )
    ).toBe(true);
  });

  test("rejects field outside type allowlist", () => {
    const r = parseCore(wrap(`description: "ok"\nsubagents: [foo]`), "lang");
    expect(
      r.errors.some((e) =>
        e.includes("unknown frontmatter field for type 'lang': subagents")
      )
    ).toBe(true);
  });

  test("review allows subagents", () => {
    const r = parseCore(
      wrap(`description: "ok"\nsubagents: [security-reviewer]`),
      "review"
    );
    expect(r.errors).toEqual([]);
    expect(r.frontmatter.subagents).toEqual(["security-reviewer"]);
  });

  test("subagent requires model", () => {
    const r = parseCore(wrap(`description: "ok"`), "subagent");
    expect(r.errors.some((e) => e.includes("missing required field: model"))).toBe(
      true
    );
  });

  test("subagent rejects bad model", () => {
    const r = parseCore(wrap(`description: "ok"\nmodel: o4-mini`), "subagent");
    expect(r.errors.some((e) => e.includes("unknown model: o4-mini"))).toBe(true);
  });

  test("subagent accepts haiku/sonnet/opus", () => {
    for (const m of ["haiku", "sonnet", "opus"]) {
      const r = parseCore(wrap(`description: "ok"\nmodel: ${m}`), "subagent");
      expect(r.errors).toEqual([]);
      expect(r.frontmatter.model).toBe(m as "haiku" | "sonnet" | "opus");
    }
  });

  test("aliases must be array of strings", () => {
    const r = parseCore(wrap(`description: "ok"\naliases: not-an-array`), "lang");
    expect(
      r.errors.some((e) => e.includes("aliases must be an array of strings"))
    ).toBe(true);
  });

  test("requires must be array of strings", () => {
    const r = parseCore(wrap(`description: "ok"\nrequires: 42`), "methodology");
    expect(
      r.errors.some((e) => e.includes("requires must be an array of strings"))
    ).toBe(true);
  });

  test("methodology rejects model field", () => {
    const r = parseCore(wrap(`description: "ok"\nmodel: opus`), "methodology");
    expect(
      r.errors.some((e) =>
        e.includes("unknown frontmatter field for type 'methodology': model")
      )
    ).toBe(true);
  });

  test("subagent rejects subagents field", () => {
    const r = parseCore(
      wrap(`description: "ok"\nmodel: opus\nsubagents: [foo]`),
      "subagent"
    );
    expect(
      r.errors.some((e) =>
        e.includes("unknown frontmatter field for type 'subagent': subagents")
      )
    ).toBe(true);
  });

  test("invalid YAML surfaces parse error", () => {
    const r = parseCore("---\n: : :\n---\n", "lang");
    expect(r.errors.some((e) => e.includes("frontmatter parse error"))).toBe(true);
  });
});

describe("bodyLineCount", () => {
  test("counts non-blank-leading lines", () => {
    expect(bodyLineCount("\n\n\nhello\nworld")).toBe(2);
  });
  test("single line", () => {
    expect(bodyLineCount("hello")).toBe(1);
  });
});
