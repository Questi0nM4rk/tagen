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

  test("accepts CRLF frontmatter delimiters", () => {
    const r = parseCore("---\r\ndescription: ok\r\n---\r\n# Body\r\n", "lang");
    expect(r.errors).toEqual([]);
    expect(r.frontmatter.description).toBe("ok");
    expect(r.body).toBe("# Body\r\n");
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

  test("minimal subagent does not require model metadata", () => {
    const r = parseCore(wrap(`description: "ok"`), "subagent");
    expect(r.errors).toEqual([]);
  });

  test("subagent rejects model as harness-specific metadata", () => {
    const r = parseCore(wrap(`description: "ok"\nmodel: o4-mini`), "subagent");
    expect(
      r.errors.some((e) =>
        e.includes("unknown frontmatter field for type 'subagent': model")
      )
    ).toBe(true);
  });

  test("subagent accepts canonical card IDs in uses", () => {
    const r = parseCore(
      wrap(`description: "ok"\nuses: [methodology/tdd, methodology/verification]`),
      "subagent"
    );
    expect(r.errors).toEqual([]);
    expect(r.frontmatter.uses).toEqual(["methodology/tdd", "methodology/verification"]);
  });

  test("uses must be an array of strings", () => {
    const r = parseCore(wrap(`description: "ok"\nuses: methodology/tdd`), "subagent");
    expect(r.errors.some((e) => e.includes("uses must be an array of strings"))).toBe(
      true
    );
  });

  test("non-subagent rejects uses", () => {
    const r = parseCore(
      wrap(`description: "ok"\nuses: [methodology/tdd]`),
      "methodology"
    );
    expect(
      r.errors.some((e) =>
        e.includes("unknown frontmatter field for type 'methodology': uses")
      )
    ).toBe(true);
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

  test("subagent rejects subagents field", () => {
    const r = parseCore(wrap(`description: "ok"\nsubagents: [foo]`), "subagent");
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
