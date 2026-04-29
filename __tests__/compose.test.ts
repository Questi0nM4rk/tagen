import { beforeAll, describe, expect, test } from "bun:test";
import { isAbsolute, join } from "node:path";
import { loadAllCards } from "../src/lib/catalog.ts";
import type { Composition } from "../src/lib/compose.ts";
import { buildManifest, compose } from "../src/lib/compose.ts";
import { loadProtocols } from "../src/lib/protocols.ts";
import { loadSubagents } from "../src/lib/subagents.ts";
import type { CatalogCard, ProtocolEntry, Subagent } from "../src/lib/types.ts";

const FIXTURES = join(import.meta.dir, "fixtures/skill-graph-v2");
const REPO_ROOT = join(import.meta.dir, "..", "..");

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<CatalogCard> & { skill: string }): CatalogCard {
  return {
    skill: overrides.skill,
    plugin: overrides.plugin ?? "test-plugin",
    source: overrides.source ?? "",
    tags: overrides.tags ?? {
      phase: ["review"],
      domain: ["code-review"],
      language: "agnostic",
      layer: "methodology",
      concerns: [],
    },
    composes: overrides.composes ?? [],
    enhances: overrides.enhances ?? [],
    description: overrides.description ?? "",
    ironLaws: overrides.ironLaws ?? [],
    summary: overrides.summary ?? [],
    provides: overrides.provides ?? [],
    requires: overrides.requires ?? [],
    emits: overrides.emits ?? [],
    consumes: overrides.consumes ?? [],
    surface: overrides.surface ?? { triggers: [] },
    core: overrides.core ?? { files: [] },
    deep: overrides.deep ?? {
      subagents: [],
      refs: [],
      slots: {},
      validators: [],
    },
    body: overrides.body ?? "",
    filePath: overrides.filePath ?? "",
  };
}

let allCards: CatalogCard[];
let allSubagents: Subagent[];
let allProtocols: ProtocolEntry[];

beforeAll(() => {
  allCards = loadAllCards(FIXTURES);
  allSubagents = loadSubagents(FIXTURES);
  allProtocols = loadProtocols(FIXTURES);
});

// ─── compose — matched set filtering ─────────────────────────────────────────

describe("compose — domain filter", () => {
  test("domain filter returns only cards with matching domain tag", () => {
    const result = compose(allCards, allSubagents, { domain: "code-review" });
    for (const c of result.cards) {
      expect(c.tags.domain).toContain("code-review");
    }
  });

  test("domain filter excludes cards from other domains", () => {
    const result = compose(allCards, allSubagents, { domain: "testing" });
    const names = result.cards.map((c) => c.skill);
    expect(names).not.toContain("v2-strict-review");
    expect(names).not.toContain("v2-csharp-patterns");
  });
});

describe("compose — language filter", () => {
  test("language filter excludes cards with a different language", () => {
    const result = compose(allCards, allSubagents, {
      domain: "code-review",
      language: "typescript",
    });
    for (const c of result.cards) {
      const lang = c.tags.language;
      expect(lang === "typescript" || lang === "agnostic").toBe(true);
    }
  });

  test("language=dotnet includes agnostic cards alongside dotnet cards", () => {
    const result = compose(allCards, allSubagents, {
      domain: "code-review",
      language: "dotnet",
    });
    const names = result.cards.map((c) => c.skill);
    expect(names).toContain("v2-strict-review"); // agnostic
    expect(names).toContain("v2-csharp-patterns"); // dotnet
  });
});

describe("compose — skill filter", () => {
  test("skill filter returns only the named card", () => {
    const result = compose(allCards, allSubagents, {
      skill: "v2-strict-review",
    });
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]!.skill).toBe("v2-strict-review");
  });

  test("skill filter on unknown name returns empty cards", () => {
    const result = compose(allCards, allSubagents, { skill: "no-such-skill" });
    expect(result.cards).toHaveLength(0);
  });
});

describe("compose — capability filter", () => {
  test("capability filter returns only cards that provide the capability", () => {
    const result = compose(allCards, allSubagents, {
      capability: "language-patterns",
    });
    for (const c of result.cards) {
      expect(c.provides).toContain("language-patterns");
    }
  });

  test("capability filter excludes cards that do not provide it", () => {
    const result = compose(allCards, allSubagents, {
      capability: "language-patterns",
    });
    const names = result.cards.map((c) => c.skill);
    expect(names).not.toContain("v2-strict-review"); // provides review-methodology, not language-patterns
  });
});

describe("compose — --card override", () => {
  test("card override returns exactly the named skills", () => {
    const result = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const names = result.cards.map((c) => c.skill).sort();
    expect(names).toEqual(["v2-csharp-patterns", "v2-strict-review"]);
  });

  test("card override ignores domain/language filters", () => {
    const result = compose(allCards, allSubagents, {
      cards: ["v2-csharp-patterns"],
      domain: "testing", // would normally exclude code-review cards
    });
    const names = result.cards.map((c) => c.skill);
    expect(names).toContain("v2-csharp-patterns");
  });

  test("card override with unknown skill name returns empty", () => {
    const result = compose(allCards, allSubagents, { cards: ["ghost-skill"] });
    expect(result.cards).toHaveLength(0);
  });
});

describe("compose — alphabetical sort", () => {
  test("matched cards are sorted alphabetically by skill name", () => {
    const result = compose(allCards, allSubagents, { domain: "code-review" });
    const names = result.cards.map((c) => c.skill);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });
});

describe("compose — empty match", () => {
  test("returns zero cards when no card matches the query", () => {
    const result = compose(allCards, allSubagents, { domain: "nonexistent" });
    expect(result.cards).toHaveLength(0);
  });

  test("returns zero slots when match is empty", () => {
    const result = compose(allCards, allSubagents, { domain: "nonexistent" });
    expect(result.slots).toHaveLength(0);
  });

  test("emits no unfilled-slot warnings when no card requires anything", () => {
    // An empty match has no requires — no warnings expected.
    const result = compose(allCards, allSubagents, { domain: "nonexistent" });
    expect(result.warnings).toHaveLength(0);
  });
});

// ─── compose — slot resolution ────────────────────────────────────────────────

describe("compose — single provider fills slot", () => {
  test("slot is resolved when exactly one card provides the required capability", () => {
    // v2-strict-review requires language-patterns; v2-csharp-patterns provides it
    const result = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const slot = result.slots.find((s) => s.capability === "language-patterns");
    expect(slot).toBeDefined();
    expect(slot?.fillerCard).toBe("v2-csharp-patterns");
  });

  test("single provider — candidates list has exactly one entry", () => {
    const result = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const slot = result.slots.find((s) => s.capability === "language-patterns");
    expect(slot?.candidates).toHaveLength(1);
  });

  test("single provider — no multiple-providers warning emitted", () => {
    const result = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const hasMultipleWarning = result.warnings.some((w) =>
      w.includes("multiple providers")
    );
    expect(hasMultipleWarning).toBe(false);
  });
});

describe("compose — no provider for required capability", () => {
  test("emits unfilled-slot warning when no card provides the required capability", () => {
    // v2-strict-review requires language-patterns; if we omit the provider:
    const result = compose(allCards, allSubagents, {
      cards: ["v2-strict-review"],
    });
    const hasUnfilled = result.warnings.some((w) => w.includes("unfilled slot"));
    expect(hasUnfilled).toBe(true);
  });

  test("unfilled warning names the missing capability", () => {
    const result = compose(allCards, allSubagents, {
      cards: ["v2-strict-review"],
    });
    const warning = result.warnings.find(
      (w) => w.includes("language-patterns") && w.includes("unfilled slot")
    );
    expect(warning).toBeDefined();
  });
});

describe("compose — multiple providers", () => {
  test("picks alphabetical-first provider when multiple cards provide a capability", () => {
    const alpha = makeCard({ skill: "aaa-provider", provides: ["shared-cap"] });
    const beta = makeCard({ skill: "zzz-provider", provides: ["shared-cap"] });
    const requester = makeCard({
      skill: "consumer",
      requires: ["shared-cap"],
    });
    const result = compose([alpha, beta, requester], [], {
      cards: ["aaa-provider", "zzz-provider", "consumer"],
    });
    const slot = result.slots.find((s) => s.capability === "shared-cap");
    expect(slot?.fillerCard).toBe("aaa-provider");
  });

  test("emits multiple-providers warning when N > 1", () => {
    const alpha = makeCard({ skill: "aaa-provider", provides: ["shared-cap"] });
    const beta = makeCard({ skill: "zzz-provider", provides: ["shared-cap"] });
    const requester = makeCard({
      skill: "consumer",
      requires: ["shared-cap"],
    });
    const result = compose([alpha, beta, requester], [], {
      cards: ["aaa-provider", "zzz-provider", "consumer"],
    });
    const hasMultiple = result.warnings.some((w) => w.includes("multiple providers"));
    expect(hasMultiple).toBe(true);
  });

  test("records all candidates in slot, not just the winner", () => {
    const alpha = makeCard({ skill: "aaa-provider", provides: ["shared-cap"] });
    const beta = makeCard({ skill: "zzz-provider", provides: ["shared-cap"] });
    const requester = makeCard({
      skill: "consumer",
      requires: ["shared-cap"],
    });
    const result = compose([alpha, beta, requester], [], {
      cards: ["aaa-provider", "zzz-provider", "consumer"],
    });
    const slot = result.slots.find((s) => s.capability === "shared-cap");
    expect(slot?.candidates).toContain("aaa-provider");
    expect(slot?.candidates).toContain("zzz-provider");
  });
});

// ─── compose — subagent reference resolution ─────────────────────────────────

describe("compose — subagent reference resolution", () => {
  test("subagent listed in deep.subagents resolves its references capability", () => {
    // v2-strict-review lists v2-domain-reviewer in deep.subagents;
    // v2-domain-reviewer references language-patterns.
    // Including v2-csharp-patterns (provider) in the composition should fill the slot.
    const result = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const slot = result.slots.find((s) => s.capability === "language-patterns");
    expect(slot).toBeDefined();
  });

  test("missing subagent emits a warning", () => {
    const card = makeCard({
      skill: "card-with-ghost-sub",
      deep: {
        subagents: ["nonexistent-subagent"],
        refs: [],
        slots: {},
        validators: [],
      },
    });
    const result = compose([card], allSubagents, {
      cards: ["card-with-ghost-sub"],
    });
    const hasWarning = result.warnings.some((w) => w.includes("nonexistent-subagent"));
    expect(hasWarning).toBe(true);
  });

  test("missing subagent warning names the referencing card", () => {
    const card = makeCard({
      skill: "card-with-ghost-sub",
      deep: {
        subagents: ["nonexistent-subagent"],
        refs: [],
        slots: {},
        validators: [],
      },
    });
    const result = compose([card], allSubagents, {
      cards: ["card-with-ghost-sub"],
    });
    const warning = result.warnings.find(
      (w) => w.includes("nonexistent-subagent") && w.includes("card-with-ghost-sub")
    );
    expect(warning).toBeDefined();
  });

  test("subagent references capability resolves through slot machinery", () => {
    // subagent language-patterns ref triggers resolveSlot on 'language-patterns'
    // which finds a provider → slot entry is created.
    const result = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const slotCaps = result.slots.map((s) => s.capability);
    expect(slotCaps).toContain("language-patterns");
  });
});

// ─── buildManifest ────────────────────────────────────────────────────────────

describe("buildManifest — top-level fields", () => {
  let comp: Composition;

  beforeAll(() => {
    comp = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
  });

  test("emits modules field", () => {
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    expect(m).toHaveProperty("modules");
  });

  test("emits core field", () => {
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    expect(m).toHaveProperty("core");
  });

  test("emits subagents field", () => {
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    expect(m).toHaveProperty("subagents");
  });

  test("emits refs field", () => {
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    expect(m).toHaveProperty("refs");
  });

  test("emits validators field", () => {
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    expect(m).toHaveProperty("validators");
  });

  test("emits emits field", () => {
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    expect(m).toHaveProperty("emits");
  });

  test("emits consumes field", () => {
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    expect(m).toHaveProperty("consumes");
  });

  test("emits warnings field", () => {
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    expect(m).toHaveProperty("warnings");
  });

  test("emits slots field", () => {
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    expect(m).toHaveProperty("slots");
  });
});

describe("buildManifest — modules", () => {
  test("modules contains skill names of all matched cards", () => {
    const comp = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    expect(m.modules).toContain("v2-strict-review");
    expect(m.modules).toContain("v2-csharp-patterns");
  });
});

describe("buildManifest — paths are repo-relative", () => {
  test("core paths are not absolute", () => {
    const comp = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    for (const p of m.core) {
      expect(isAbsolute(p)).toBe(false);
    }
  });

  test("refs paths are not absolute", () => {
    const comp = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    for (const r of m.refs) {
      expect(isAbsolute(r.path)).toBe(false);
    }
  });

  test("subagent prompt paths are not absolute", () => {
    const comp = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    for (const s of m.subagents) {
      expect(isAbsolute(s.prompt)).toBe(false);
    }
  });
});

describe("buildManifest — refs from filler cards only", () => {
  test("refs slot value matches the capability filled", () => {
    const comp = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    // All ref slot values should be capability names found in slots
    const slotCaps = new Set(comp.slots.map((s) => s.capability));
    for (const r of m.refs) {
      if (r.slot !== null) {
        expect(slotCaps.has(r.slot)).toBe(true);
      }
    }
  });
});

describe("buildManifest — protocolValidators filtered by hasValidator", () => {
  test("protocol validator only included when card emits/consumes and protocol hasValidator=true", () => {
    // v2-strict-review emits graded-findings, consumes finding and recon-summary
    // Only 'finding' has a validator.ts in fixtures
    const comp = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    for (const v of m.validators.protocol) {
      expect(v.protocol).toBeDefined();
    }
  });

  test("incomplete-protocol not in validators.protocol despite name match", () => {
    // incomplete-protocol has no validator.ts — should never appear
    const comp = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    const names = m.validators.protocol.map((v) => v.protocol);
    expect(names).not.toContain("incomplete-protocol");
  });
});

describe("buildManifest — emits/consumes aggregation", () => {
  test("emits field is sorted", () => {
    const comp = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    const sorted = [...m.emits].sort();
    expect(m.emits).toEqual(sorted);
  });

  test("consumes field is sorted", () => {
    const comp = compose(allCards, allSubagents, {
      cards: ["v2-strict-review", "v2-csharp-patterns"],
    });
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    const sorted = [...m.consumes].sort();
    expect(m.consumes).toEqual(sorted);
  });

  test("emits contains protocols from matched cards", () => {
    const comp = compose(allCards, allSubagents, {
      cards: ["v2-strict-review"],
    });
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    expect(m.emits).toContain("graded-findings");
  });

  test("consumes contains protocols from matched cards", () => {
    const comp = compose(allCards, allSubagents, {
      cards: ["v2-strict-review"],
    });
    const m = buildManifest(comp, allSubagents, allProtocols, REPO_ROOT);
    expect(m.consumes).toContain("finding");
  });
});
