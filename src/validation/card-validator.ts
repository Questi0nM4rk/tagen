import { existsSync, statSync } from "node:fs";
import { findAliasCollisions } from "../lib/aliases.ts";
import { findUsesCycles, resolveUses } from "../lib/card-references.ts";
import { bodyLineCount } from "../lib/frontmatter.ts";
import {
  type Card,
  cardIndex,
  cardKey,
  isSubagentHostType,
  KEBAB_NAME,
} from "../lib/types.ts";

export function validateCards(
  cards: readonly Card[],
  frontmatterErrors: ReadonlyMap<string, readonly string[]>
): readonly string[] {
  const violations: string[] = [];
  const knownTypes = new Set(cards.map((card) => card.id.type));
  const index = cardIndex(cards);

  for (const card of cards) {
    violations.push(...validateCardFilesystem(card));
    violations.push(...prefixFrontmatterErrors(card, frontmatterErrors));
    violations.push(...validateRequires(card, knownTypes));
    violations.push(...resolveUses(card, cards).errors);
    violations.push(...validateSubagentReferences(card, index));
    violations.push(...validateValidatorScope(card));
  }

  violations.push(...findAliasCollisions(cards));
  violations.push(...findUsesCycles(cards));
  return Object.freeze(violations);
}

function validateCardFilesystem(card: Card): readonly string[] {
  const violations: string[] = [];
  if (!KEBAB_NAME.test(card.id.name)) {
    violations.push(`${cardKey(card.id)}: card name must match [a-z][a-z0-9-]*`);
  }
  if (!KEBAB_NAME.test(card.id.type)) {
    violations.push(`${card.id.type}: type name must match [a-z][a-z0-9-]*`);
  }
  if (!existsSync(card.corePath) || !statSync(card.corePath).isFile()) {
    violations.push(`${cardKey(card.id)}/CORE.md: must be a file`);
    return violations;
  }
  const lines = bodyLineCount(card.body);
  if (lines > 300) {
    violations.push(
      `${cardKey(card.id)}/CORE.md: exceeds 300 lines (got ${lines}); move overflow into references/`
    );
  }
  return violations;
}

function prefixFrontmatterErrors(
  card: Card,
  frontmatterErrors: ReadonlyMap<string, readonly string[]>
): readonly string[] {
  const key = cardKey(card.id);
  return (frontmatterErrors.get(key) ?? []).map((error) => `${key}: ${error}`);
}

function validateRequires(
  card: Card,
  knownTypes: ReadonlySet<string>
): readonly string[] {
  return (card.frontmatter.requires ?? [])
    .filter((requiredType) => !knownTypes.has(requiredType))
    .map(
      (requiredType) => `${cardKey(card.id)}: unknown type in requires: ${requiredType}`
    );
}

function validateSubagentReferences(
  card: Card,
  index: ReadonlyMap<string, Card>
): readonly string[] {
  const subagents = card.frontmatter.subagents ?? [];
  if (subagents.length === 0) return [];
  if (!isSubagentHostType(card.id.type)) {
    return [
      `${cardKey(card.id)}: subagents allowed only on review and methodology cards`,
    ];
  }
  return subagents
    .filter((name) => !index.has(cardKey({ type: "subagent", name })))
    .map((name) => `${cardKey(card.id)}: unknown subagent in subagents: ${name}`);
}

function validateValidatorScope(card: Card): readonly string[] {
  if (card.validators.length === 0 || isSubagentHostType(card.id.type)) {
    return [];
  }
  return [
    `${cardKey(card.id)}: validators/ allowed only on review and methodology cards`,
  ];
}
