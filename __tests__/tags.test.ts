import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runTags } from "../src/commands/tags.ts";
import { loadCapabilities } from "../src/lib/capabilities.ts";
import { loadProtocols } from "../src/lib/protocols.ts";
import { loadSubagents } from "../src/lib/subagents.ts";
import { loadVocabulary } from "../src/lib/vocabulary.ts";
import { captureStdout } from "./helpers/capture.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph");

describe("runTags — JSON shape", () => {
  test("emits a single object with tags / capabilities / protocols / subagents", () => {
    const vocab = loadVocabulary(FIXTURES);
    const caps = loadCapabilities(FIXTURES);
    const protocols = loadProtocols(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() => runTags(vocab, caps, protocols, subs, true));
    const parsed = JSON.parse(out) as Record<string, unknown>;
    for (const key of ["tags", "capabilities", "protocols", "subagents"]) {
      expect(parsed).toHaveProperty(key);
    }
  });

  test("subagents entries carry name / model / description only", () => {
    const vocab = loadVocabulary(FIXTURES);
    const caps = loadCapabilities(FIXTURES);
    const protocols = loadProtocols(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() => runTags(vocab, caps, protocols, subs, true));
    const parsed = JSON.parse(out) as { subagents: Record<string, unknown>[] };
    for (const s of parsed.subagents) {
      expect(Object.keys(s).sort()).toEqual(["description", "model", "name"]);
    }
  });

  test("protocols list is the controlled vocabulary, not the entries", () => {
    const vocab = loadVocabulary(FIXTURES);
    const caps = loadCapabilities(FIXTURES);
    const protocols = loadProtocols(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() => runTags(vocab, caps, protocols, subs, true));
    const parsed = JSON.parse(out) as { protocols: string[] };
    expect(Array.isArray(parsed.protocols)).toBe(true);
    expect(parsed.protocols.every((p) => typeof p === "string")).toBe(true);
  });
});

describe("runTags — text output", () => {
  test("includes every controlled vocabulary section header", () => {
    const vocab = loadVocabulary(FIXTURES);
    const caps = loadCapabilities(FIXTURES);
    const protocols = loadProtocols(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() => runTags(vocab, caps, protocols, subs, false));
    expect(out).toContain("capabilities");
    expect(out).toContain("protocols");
    expect(out).toContain("subagents");
    for (const dim of Object.keys(vocab.dimensions)) {
      expect(out).toContain(dim);
    }
  });

  test("flags protocols missing required artifacts (e.g. no-validator)", () => {
    // The fixture's incomplete-protocol has no validator/schema → text output
    // must surface the [no-...] tag so a human can spot it without --json.
    const vocab = loadVocabulary(FIXTURES);
    const caps = loadCapabilities(FIXTURES);
    const protocols = loadProtocols(FIXTURES);
    const subs = loadSubagents(FIXTURES);
    const out = captureStdout(() => runTags(vocab, caps, protocols, subs, false));
    if (protocols.some((p) => !p.hasValidator)) {
      expect(out).toContain("no-validator");
    }
  });
});
