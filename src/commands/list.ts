import { type Card, type CardType, cardKey } from "../lib/types.ts";

export interface ListOptions {
  json: boolean;
  /** Filter to a single type dir under brain/. */
  type?: CardType;
  /** Include each card's aliases beside its canonical name. */
  aliases: boolean;
}

interface JsonEntry {
  type: CardType;
  name: string;
  aliases?: string[];
}

/**
 * Browse the catalog. Default: every card as `<type>/<name>` to stdout.
 * `--type T` restricts to one type. `--aliases` adds alias info.
 */
export function runList(cards: Card[], opts: ListOptions): void {
  const filtered = opts.type ? cards.filter((c) => c.id.type === opts.type) : cards;

  if (opts.json) {
    const entries: JsonEntry[] = filtered.map((c) => {
      const e: JsonEntry = { type: c.id.type, name: c.id.name };
      if (opts.aliases) e.aliases = c.frontmatter.aliases ?? [];
      return e;
    });
    process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
    return;
  }

  for (const c of filtered) {
    const head = cardKey(c.id);
    const aliases = c.frontmatter.aliases ?? [];
    if (!opts.aliases || aliases.length === 0) {
      process.stdout.write(`${head}\n`);
    } else {
      process.stdout.write(`${head}  (${aliases.join(", ")})\n`);
    }
  }
}
