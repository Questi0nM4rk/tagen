import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parseCore } from "./frontmatter.ts";
import type { Card, CardId, Protocol } from "./types.ts";

export const MAX_DISCOVERY_HOPS = 10;
export const BRAIN_DIR = "brain";
export const CORE_FILE = "CORE.md";

export interface LoadResult {
  /** All non-protocol cards. */
  cards: Card[];
  /** Protocol cards (also present in `cards`, with protocol-specific paths). */
  protocols: Protocol[];
  /** Per-card frontmatter parse errors keyed by `<type>/<name>`. */
  frontmatterErrors: Map<string, string[]>;
}

/**
 * Walk up from `start` (default cwd) up to MAX_DISCOVERY_HOPS looking for a
 * `brain/` directory containing at least one type subdir with at least one
 * card containing CORE.md. The first match wins.
 */
export function findBrainDir(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (let hops = 0; hops <= MAX_DISCOVERY_HOPS; hops++) {
    const brain = join(dir, BRAIN_DIR);
    if (looksLikeBrain(brain)) return brain;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `tagen: no brain/ directory found from ${start} (searched up to ${MAX_DISCOVERY_HOPS} parents)`
  );
}

/** brain/ exists and has at least one type dir with at least one card/CORE.md. */
function looksLikeBrain(brain: string): boolean {
  if (!existsSync(brain) || !statSync(brain).isDirectory()) return false;
  for (const type of readdirSync(brain)) {
    const typeDir = join(brain, type);
    if (!isDir(typeDir)) continue;
    for (const name of readdirSync(typeDir)) {
      const cardDir = join(typeDir, name);
      if (!isDir(cardDir)) continue;
      if (existsSync(join(cardDir, CORE_FILE))) return true;
    }
  }
  return false;
}

/** The marketplace root: the parent of `brain/`. All manifest paths are relative to this. */
export function marketplaceRoot(brainDir: string): string {
  return dirname(brainDir);
}

/**
 * Walk `brainDir` building Card / Protocol entries. Frontmatter parse errors
 * are collected (not thrown) so `tagen validate` can surface every violation.
 */
export function loadAllCards(brainDir: string): LoadResult {
  const root = marketplaceRoot(brainDir);
  const cards: Card[] = [];
  const protocols: Protocol[] = [];
  const frontmatterErrors = new Map<string, string[]>();

  for (const type of readdirSync(brainDir).sort()) {
    const typeDir = join(brainDir, type);
    if (!isDir(typeDir)) continue;
    for (const name of readdirSync(typeDir).sort()) {
      const cardDir = join(typeDir, name);
      if (!isDir(cardDir)) continue;
      const corePath = join(cardDir, CORE_FILE);
      if (!existsSync(corePath)) continue;

      const id: CardId = { type, name };
      const source = readFileSync(corePath, "utf8");
      const parsed = parseCore(source, type);
      if (parsed.errors.length > 0) {
        frontmatterErrors.set(`${type}/${name}`, parsed.errors);
      }

      const card: Card = {
        id,
        dirPath: cardDir,
        corePath,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        references: listFiles(join(cardDir, "references"), ".md", root),
        validators: listFiles(join(cardDir, "validators"), ".ts", root),
      };
      cards.push(card);

      if (type === "protocol") {
        protocols.push(toProtocol(card, root));
      }
    }
  }

  return { cards, protocols, frontmatterErrors };
}

function toProtocol(card: Card, root: string): Protocol {
  return {
    ...card,
    schemaPath: rel(join(card.dirPath, "schema.json"), root),
    validatorPath: rel(join(card.dirPath, "validator.ts"), root),
    validExamples: listFiles(join(card.dirPath, "examples", "valid"), ".json", root),
    invalidExamples: listFiles(
      join(card.dirPath, "examples", "invalid"),
      ".json",
      root
    ),
  };
}

function listFiles(dir: string, ext: string, root: string): string[] {
  if (!existsSync(dir) || !isDir(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => rel(join(dir, f), root));
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Root-relative form of an absolute path. Exported so commands and compose
 * use one definition (manifest paths must all be relative to `root`). */
export function rel(absPath: string, root: string): string {
  return relative(root, absPath);
}
