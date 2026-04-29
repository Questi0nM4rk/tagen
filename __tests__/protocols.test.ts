import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  allProtocolNames,
  isValidProtocol,
  loadProtocols,
} from "../src/lib/protocols.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph-v2");

// ─── loadProtocols ────────────────────────────────────────────────────────────

describe("loadProtocols", () => {
  test("returns empty array when protocols/ directory is absent", () => {
    const result = loadProtocols("/nonexistent/path");
    expect(result).toHaveLength(0);
  });

  test("discovers subdirectories as protocol entries", () => {
    const result = loadProtocols(FIXTURES);
    expect(result.length).toBeGreaterThan(0);
  });

  test("full directory — name is set from directory name", () => {
    const result = loadProtocols(FIXTURES);
    const finding = result.find((p) => p.name === "finding");
    expect(finding).toBeDefined();
  });

  test("full directory — hasSchema is true when schema.json exists", () => {
    const result = loadProtocols(FIXTURES);
    const finding = result.find((p) => p.name === "finding");
    expect(finding?.hasSchema).toBe(true);
  });

  test("full directory — hasDoc is true when protocol.md exists", () => {
    const result = loadProtocols(FIXTURES);
    const finding = result.find((p) => p.name === "finding");
    expect(finding?.hasDoc).toBe(true);
  });

  test("full directory — hasValidator is true when validator.ts exists", () => {
    const result = loadProtocols(FIXTURES);
    const finding = result.find((p) => p.name === "finding");
    expect(finding?.hasValidator).toBe(true);
  });

  test("full directory — hasValidExamples is true when valid/ has json files", () => {
    const result = loadProtocols(FIXTURES);
    const finding = result.find((p) => p.name === "finding");
    expect(finding?.hasValidExamples).toBe(true);
  });

  test("full directory — hasInvalidExamples is true when invalid/ has json files", () => {
    const result = loadProtocols(FIXTURES);
    const finding = result.find((p) => p.name === "finding");
    expect(finding?.hasInvalidExamples).toBe(true);
  });

  test("incomplete protocol — hasSchema is false when schema.json absent", () => {
    const result = loadProtocols(FIXTURES);
    const incomplete = result.find((p) => p.name === "incomplete-protocol");
    expect(incomplete?.hasSchema).toBe(false);
  });

  test("incomplete protocol — hasValidator is false when validator.ts absent", () => {
    const result = loadProtocols(FIXTURES);
    const incomplete = result.find((p) => p.name === "incomplete-protocol");
    expect(incomplete?.hasValidator).toBe(false);
  });

  test("incomplete protocol — hasValidExamples is false when examples/valid/ absent", () => {
    const result = loadProtocols(FIXTURES);
    const incomplete = result.find((p) => p.name === "incomplete-protocol");
    expect(incomplete?.hasValidExamples).toBe(false);
  });

  test("incomplete protocol — hasInvalidExamples is false when examples/invalid/ absent", () => {
    const result = loadProtocols(FIXTURES);
    const incomplete = result.find((p) => p.name === "incomplete-protocol");
    expect(incomplete?.hasInvalidExamples).toBe(false);
  });

  test("non-directory entries inside protocols/ are skipped", () => {
    // The fixture protocols/ dir contains only directories — confirm count
    // matches only the known subdirs (finding, incomplete-protocol).
    const result = loadProtocols(FIXTURES);
    const names = result.map((p) => p.name);
    expect(names).not.toContain("schema.json");
    expect(names).not.toContain("protocol.md");
  });

  test("results are sorted alphabetically by name", () => {
    const result = loadProtocols(FIXTURES);
    const names = result.map((p) => p.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  test("dirPath is set to the absolute path of the protocol directory", () => {
    const result = loadProtocols(FIXTURES);
    const finding = result.find((p) => p.name === "finding");
    expect(finding?.dirPath).toContain("finding");
  });
});

// ─── isValidProtocol ──────────────────────────────────────────────────────────

describe("isValidProtocol", () => {
  test("returns true for a protocol that was loaded", () => {
    const protocols = loadProtocols(FIXTURES);
    expect(isValidProtocol(protocols, "finding")).toBe(true);
  });

  test("returns true for the incomplete-protocol fixture", () => {
    const protocols = loadProtocols(FIXTURES);
    expect(isValidProtocol(protocols, "incomplete-protocol")).toBe(true);
  });

  test("returns false for an unknown protocol name", () => {
    const protocols = loadProtocols(FIXTURES);
    expect(isValidProtocol(protocols, "nonexistent-protocol")).toBe(false);
  });

  test("returns false on an empty list", () => {
    expect(isValidProtocol([], "finding")).toBe(false);
  });
});

// ─── allProtocolNames ─────────────────────────────────────────────────────────

describe("allProtocolNames", () => {
  test("returns names of all loaded protocols", () => {
    const protocols = loadProtocols(FIXTURES);
    const names = allProtocolNames(protocols);
    expect(names).toContain("finding");
    expect(names).toContain("incomplete-protocol");
  });

  test("count matches number of loaded protocols", () => {
    const protocols = loadProtocols(FIXTURES);
    const names = allProtocolNames(protocols);
    expect(names).toHaveLength(protocols.length);
  });

  test("returns empty array when protocols list is empty", () => {
    expect(allProtocolNames([])).toHaveLength(0);
  });

  test("preserves sort order from loadProtocols", () => {
    const protocols = loadProtocols(FIXTURES);
    const names = allProtocolNames(protocols);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });
});
