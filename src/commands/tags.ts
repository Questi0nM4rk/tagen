import type { Vocabulary } from "../lib/types";

export function runTags(vocab: Vocabulary, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(vocab.dimensions, null, 2)}\n`);
    return;
  }

  for (const [name, dim] of Object.entries(vocab.dimensions)) {
    process.stdout.write(`\n${name} — ${dim.description}\n`);
    if (dim.order) {
      process.stdout.write(`  (order: ${dim.order.join(" → ")})\n`);
    }
    for (const [value, desc] of Object.entries(dim.values)) {
      process.stdout.write(`  ${value.padEnd(24)} ${desc}\n`);
    }
  }
  process.stdout.write("\n");
}
