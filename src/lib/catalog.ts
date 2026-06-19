import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
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
  /** Catalog-shape errors that prevent safely loading a card. */
  catalogErrors: string[];
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
  const brainStat = lstatSync(brainDir);
  const catalogErrors = brainStat.isSymbolicLink()
    ? ["brain: symlinks are not allowed under brain/"]
    : findSymlinkErrors(brainDir, root);
  if (brainStat.isSymbolicLink()) {
    return { cards, protocols, frontmatterErrors, catalogErrors };
  }

  for (const type of readdirSync(brainDir).sort()) {
    const typeDir = join(brainDir, type);
    if (!isDir(typeDir)) {
      if (!lstatSync(typeDir).isSymbolicLink()) {
        catalogErrors.push(`${type}: type must be a directory`);
      }
      continue;
    }
    for (const name of readdirSync(typeDir).sort()) {
      const cardDir = join(typeDir, name);
      if (!isDir(cardDir)) {
        if (!lstatSync(cardDir).isSymbolicLink()) {
          catalogErrors.push(`${type}/${name}: card must be a directory`);
        }
        continue;
      }
      const corePath = join(cardDir, CORE_FILE);

      const id: CardId = { type, name };
      let coreStat: ReturnType<typeof lstatSync>;
      try {
        coreStat = lstatSync(corePath);
      } catch {
        catalogErrors.push(`${type}/${name}/CORE.md: missing required file`);
        continue;
      }
      if (coreStat.isSymbolicLink()) continue;
      if (!coreStat.isFile()) {
        catalogErrors.push(`${type}/${name}/CORE.md: must be a regular file`);
        continue;
      }
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

  return { cards, protocols, frontmatterErrors, catalogErrors };
}

function findSymlinkErrors(dir: string, root: string): string[] {
  const errors: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(`${rel(path, root)}: symlinks are not allowed under brain/`);
      continue;
    }
    if (entry.isDirectory()) errors.push(...findSymlinkErrors(path, root));
  }
  return errors;
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
    return lstatSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Root-relative form of an absolute path. Exported so commands and compose
 * use one definition (manifest paths must all be relative to `root`). */
export function rel(absPath: string, root: string): string {
  return relative(root, absPath).split(sep).join("/");
}
