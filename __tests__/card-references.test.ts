import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  expandDirectUses,
  findUsesCycles,
  resolveUses,
} from "../src/lib/card-references.ts";
import { loadAllCards } from "../src/lib/catalog.ts";

const BRAIN = join(import.meta.dir, "fixtures", "brain");
const { cards } = loadAllCards(BRAIN);

describe("card references", () => {
  test("resolves canonical type/name IDs and deduplicates", () => {
    const implementer = cards.find((card) => card.id.name === "implementer");
    if (!implementer) throw new Error("fixture missing");
    const owner = {
      ...implementer,
      frontmatter: {
        ...implementer.frontmatter,
        uses: ["methodology/tdd", "methodology/tdd"],
      },
    };
    const result = resolveUses(owner, cards);
    expect(result.errors).toEqual([]);
    expect(result.cards.map((card) => `${card.id.type}/${card.id.name}`)).toEqual([
      "methodology/tdd",
    ]);
  });

  test("expands only the original seed set", () => {
    const implementer = cards.find((card) => card.id.name === "implementer");
    const tdd = cards.find((card) => card.id.name === "tdd");
    if (!implementer || !tdd) throw new Error("fixture missing");
    const modified = cards.map((card) =>
      card === tdd
        ? {
            ...card,
            frontmatter: { ...card.frontmatter, uses: ["architecture/cli"] },
          }
        : card
    );
    const result = expandDirectUses([implementer], modified);
    expect(result.cards.some((card) => card.id.name === "tdd")).toBe(true);
    expect(result.cards.some((card) => card.id.name === "cli")).toBe(false);
  });

  test("reports deterministic cycles", () => {
    const base = cards[0];
    if (!base) throw new Error("fixture missing");
    const a = {
      ...base,
      id: { type: "subagent", name: "a" },
      frontmatter: {
        description: "a",
        uses: ["subagent/b"],
      },
    };
    const b = {
      ...base,
      id: { type: "subagent", name: "b" },
      frontmatter: {
        description: "b",
        uses: ["subagent/a"],
      },
    };
    expect(findUsesCycles([a, b])).toEqual([
      "uses cycle: subagent/a -> subagent/b -> subagent/a",
    ]);
  });
});
