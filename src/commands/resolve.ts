import { expandComposes, filterCards, sortCards } from "../lib/catalog";
import type { CatalogCard, ResolvedPath, Vocabulary } from "../lib/types";

export function runResolve(
  cards: CatalogCard[],
  vocab: Vocabulary,
  args: string[],
  json: boolean
): void {
  const filters = parseFilters(args);

  if (Object.keys(filters).length === 0) {
    process.stderr.write(
      "No filters provided. Use --phase, --domain, --language, --layer, or --concerns.\n"
    );
    process.stderr.write("Example: tagen resolve --phase design --language dotnet\n");
    process.exit(1);
  }

  const shouldExpand = args.includes("--expand");

  let matched = filterCards(cards, filters);
  const directMatches = new Set(matched.map((c) => c.skill));
  matched = sortCards(matched, vocab);

  if (shouldExpand) {
    matched = sortCards(expandComposes(matched, cards), vocab);
  }

  if (json) {
    const result: ResolvedPath = {
      filters,
      path: matched.map((c) => ({
        skill: c.skill,
        layer: c.tags.layer,
        source: c.source,
        description: c.description,
        expanded: !directMatches.has(c.skill),
      })),
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (matched.length === 0) {
    process.stdout.write("No skills match the given filters.\n");
    process.exit(0);
  }

  process.stdout.write(`\nResolved path (${matched.length} skills):\n\n`);
  for (let i = 0; i < matched.length; i++) {
    const c = matched[i];
    const num = String(i + 1).padStart(2, " ");
    const layer = `[${c.tags.layer}]`.padEnd(18);
    process.stdout.write(`  ${num}. ${c.skill.padEnd(26)} ${layer} ${c.description}\n`);
  }

  process.stdout.write("\nSources:\n");
  for (const c of matched) {
    process.stdout.write(`  ${c.source}\n`);
  }
  process.stdout.write("\n");
}

function parseFilters(args: string[]): Record<string, string[]> {
  const filters: Record<string, string[]> = {};
  const dimensions = ["phase", "domain", "language", "layer", "concerns"];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;

    const dim = arg.slice(2);
    if (!dimensions.includes(dim)) continue;

    const next = args[i + 1];
    if (!next || next.startsWith("--")) continue;

    filters[dim] = next.split(",").map((v) => v.trim());
    i++;
  }

  return filters;
}
