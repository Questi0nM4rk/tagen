import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { allCapabilities, isValidCapability } from "../lib/capabilities";
import { isValidProtocol } from "../lib/protocols";
import { filenameStem } from "../lib/subagents";
import type {
  CapabilityRegistry,
  CatalogCard,
  ProtocolEntry,
  Subagent,
  SubagentModel,
  Vocabulary,
} from "../lib/types";
import { validateCard } from "../lib/vocabulary";

const VALID_MODELS: readonly SubagentModel[] = ["haiku", "sonnet", "opus"] as const;

interface CardCtx {
  capabilities: CapabilityRegistry;
  protocols: ProtocolEntry[];
  subagentNames: Set<string>;
  validCapabilitiesList: string;
  vocab: Vocabulary;
  root: string;
}

function checkCard(card: CatalogCard, ctx: CardCtx): string[] {
  const errors: string[] = [];
  const prefix = `[${card.skill}]`;

  if (!card.description) {
    errors.push(`${prefix} missing required field: description`);
  }

  errors.push(...validateCard(card, ctx.vocab));

  for (const legacy of card.legacyFields) {
    errors.push(
      `${prefix} legacy field '${legacy}' no longer supported (rename per SPEC-tagen)`
    );
  }

  for (const cap of card.provides) {
    if (!isValidCapability(ctx.capabilities, cap)) {
      errors.push(
        `${prefix} unknown capability in provides: "${cap}" (valid: ${ctx.validCapabilitiesList})`
      );
    }
  }
  for (const cap of card.requires) {
    if (!isValidCapability(ctx.capabilities, cap)) {
      errors.push(`${prefix} unknown capability in requires: "${cap}"`);
    }
  }
  for (const slotCap of Object.keys(card.deep.slots)) {
    if (!isValidCapability(ctx.capabilities, slotCap)) {
      errors.push(`${prefix} unknown capability in deep.slots: "${slotCap}"`);
    }
  }
  for (const proto of card.emits) {
    if (!isValidProtocol(ctx.protocols, proto)) {
      errors.push(`${prefix} unknown protocol in emits: "${proto}"`);
    }
  }
  for (const proto of card.consumes) {
    if (!isValidProtocol(ctx.protocols, proto)) {
      errors.push(`${prefix} unknown protocol in consumes: "${proto}"`);
    }
  }

  for (const subName of card.deep.subagents) {
    if (!ctx.subagentNames.has(subName)) {
      errors.push(`${prefix} unknown subagent in deep.subagents: "${subName}"`);
    }
  }

  const brainRoot = resolve(ctx.root, "brain", card.skill);
  for (const p of [...card.core.files, ...card.deep.refs, ...card.deep.validators]) {
    if (!existsSync(resolve(brainRoot, p))) {
      errors.push(`${prefix} path not found: brain/${card.skill}/${p}`);
    }
  }

  return errors;
}

function checkProtocol(p: ProtocolEntry): string[] {
  const errors: string[] = [];
  const prefix = `[protocol:${p.name}]`;
  if (!p.hasSchema) errors.push(`${prefix} missing schema.json`);
  if (!p.hasDoc) errors.push(`${prefix} missing protocol.md`);
  if (!p.hasValidator) errors.push(`${prefix} missing validator.ts`);
  if (!p.hasValidExamples) {
    errors.push(`${prefix} missing examples/valid/*.json (need at least one)`);
  }
  if (!p.hasInvalidExamples) {
    errors.push(`${prefix} missing examples/invalid/*.json (need at least one)`);
  }
  return errors;
}

function checkSubagent(
  sub: Subagent,
  capabilities: CapabilityRegistry,
  protocols: ProtocolEntry[]
): string[] {
  const errors: string[] = [];
  const prefix = `[subagent:${sub.name}]`;

  const stem = filenameStem(sub.filePath);
  if (sub.name !== stem) {
    errors.push(
      `${prefix} frontmatter name "${sub.name}" does not match filename "${stem}.md"`
    );
  }

  if (!sub.model) {
    errors.push(`${prefix} missing required frontmatter field: model`);
  } else if (!VALID_MODELS.includes(sub.model)) {
    errors.push(
      `${prefix} unknown model "${sub.model}" (valid: ${VALID_MODELS.join(", ")})`
    );
  }

  if (!sub.description) {
    errors.push(`${prefix} missing required frontmatter field: description`);
  }

  for (const p of sub.consumes) {
    if (!isValidProtocol(protocols, p)) {
      errors.push(`${prefix} unknown protocol in consumes: "${p}"`);
    }
  }
  for (const p of sub.emits) {
    if (!isValidProtocol(protocols, p)) {
      errors.push(`${prefix} unknown protocol in emits: "${p}"`);
    }
  }
  for (const cap of sub.references) {
    if (!isValidCapability(capabilities, cap)) {
      errors.push(`${prefix} unknown capability in references: "${cap}"`);
    }
  }
  return errors;
}

function dupErrors<T>(
  items: T[],
  key: (t: T) => string,
  prefix: (k: string) => string
): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) errors.push(prefix(k));
    seen.add(k);
  }
  return errors;
}

export function runValidate(
  cards: CatalogCard[],
  vocab: Vocabulary,
  capabilities: CapabilityRegistry,
  protocols: ProtocolEntry[],
  subagents: Subagent[],
  root: string
): void {
  const ctx: CardCtx = {
    capabilities,
    protocols,
    subagentNames: new Set(subagents.map((s) => s.name)),
    validCapabilitiesList: allCapabilities(capabilities).join(", ") || "none loaded",
    vocab,
    root,
  };

  const errors: string[] = [
    ...dupErrors(
      cards,
      (c) => c.skill,
      (k) => `[${k}] duplicate skill name`
    ),
    ...cards.flatMap((c) => checkCard(c, ctx)),
    ...protocols.flatMap(checkProtocol),
    ...dupErrors(
      subagents,
      (s) => s.name,
      (k) => `[subagent:${k}] duplicate subagent name`
    ),
    ...subagents.flatMap((s) => checkSubagent(s, capabilities, protocols)),
  ];

  if (errors.length === 0) {
    process.stdout.write(
      `All ${cards.length} card(s), ${subagents.length} subagent(s), ${protocols.length} protocol(s) valid.\n`
    );
    process.exit(0);
  }

  process.stderr.write(`${errors.length} error(s):\n`);
  for (const err of errors) process.stderr.write(`  ${err}\n`);
  process.exit(1);
}
