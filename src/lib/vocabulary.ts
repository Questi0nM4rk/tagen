import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { CatalogCard, Vocabulary } from "./types";

export function findVaultDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "skill-graph", "vocabulary.yaml");
    if (existsSync(candidate)) {
      return join(dir, "skill-graph");
    }
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    "Could not find skill-graph/vocabulary.yaml — are you in the marketplace repo?"
  );
}

export function repoRoot(vaultDir: string): string {
  return resolve(dirname(vaultDir));
}

export function loadVocabulary(vaultDir: string): Vocabulary {
  const raw = readFileSync(join(vaultDir, "vocabulary.yaml"), "utf8");
  return parseYaml(raw) as Vocabulary;
}

export function getValidValues(vocab: Vocabulary, dimension: string): string[] {
  const dim = vocab.dimensions[dimension];
  if (!dim) return [];
  return Object.keys(dim.values);
}

export function getOrder(vocab: Vocabulary, dimension: string): string[] {
  const dim = vocab.dimensions[dimension];
  if (!dim) return [];
  return dim.order ?? Object.keys(dim.values);
}

export function validateCard(card: CatalogCard, vocab: Vocabulary): string[] {
  const errors: string[] = [];
  const prefix = `[${card.skill}]`;

  for (const dim of ["phase", "domain", "language", "layer"]) {
    const tagValue = card.tags[dim as keyof typeof card.tags];
    if (tagValue === undefined || tagValue === null) {
      errors.push(`${prefix} missing required tag dimension: ${dim}`);
      continue;
    }

    const valid = getValidValues(vocab, dim);
    const values = Array.isArray(tagValue) ? tagValue : [tagValue];
    for (const v of values) {
      if (!valid.includes(v)) {
        errors.push(
          `${prefix} unknown ${dim} value: "${v}" (valid: ${valid.join(", ")})`
        );
      }
    }
  }

  if (card.tags.concerns) {
    const validConcerns = getValidValues(vocab, "concerns");
    for (const c of card.tags.concerns) {
      if (!validConcerns.includes(c)) {
        errors.push(
          `${prefix} unknown concern: "${c}" (valid: ${validConcerns.join(", ")})`
        );
      }
    }
  }

  return errors;
}
