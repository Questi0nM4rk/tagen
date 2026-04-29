import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { allCapabilities, isValidCapability } from "../lib/capabilities";
import { sourceExists } from "../lib/catalog";
import { isValidProtocol } from "../lib/protocols";
import { filenameStem } from "../lib/subagents";
import type {
  CapabilityRegistry,
  CatalogCard,
  ProtocolEntry,
  Subagent,
  Vocabulary,
} from "../lib/types";
import { validateCard } from "../lib/vocabulary";

const VALID_MODELS = ["haiku", "sonnet", "opus"] as const;

export function runValidate(
  cards: CatalogCard[],
  vocab: Vocabulary,
  capabilities: CapabilityRegistry,
  protocols: ProtocolEntry[],
  subagents: Subagent[],
  root: string
): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  const allSkillNames = new Set(cards.map((c) => c.skill));
  const seenCardNames = new Set<string>();
  const seenSubagentNames = new Set<string>();
  // Hoisted out of the per-card loop — these don't change across cards.
  const subagentNames = new Set(subagents.map((s) => s.name));
  const validCapabilitiesList =
    allCapabilities(capabilities).join(", ") || "none loaded";

  // ── Cards ────────────────────────────────────────────────────────────────
  for (const card of cards) {
    const prefix = `[${card.skill}]`;

    if (seenCardNames.has(card.skill)) {
      errors.push(`${prefix} duplicate skill name`);
    }
    seenCardNames.add(card.skill);

    errors.push(...validateCard(card, vocab));

    // v1 `source:` — if present, must exist. v2 cards that omit it resolve
    // to brain/<skill>/ by convention; no check needed.
    if (card.source && !sourceExists(card, root)) {
      errors.push(`${prefix} source not found: ${card.source}`);
    }

    // v1 relationships — warn on deprecated usage, don't error.
    for (const ref of [...card.composes, ...card.enhances]) {
      if (!allSkillNames.has(ref)) {
        errors.push(`${prefix} references unknown skill: "${ref}"`);
      }
    }
    if (card.composes.length > 0 || card.enhances.length > 0) {
      warnings.push(
        `${prefix} uses deprecated composes/enhances — migrate to provides/requires`
      );
    }
    if (card.ironLaws.length > 0 && card.summary.length === 0) {
      warnings.push(
        `${prefix} uses deprecated iron_laws: — rename frontmatter field to summary:`
      );
    }
    if (card.source) {
      warnings.push(
        `${prefix} has deprecated source: field — drop it; module root resolves by convention`
      );
    }

    // v2 field validation (only when present)
    for (const cap of card.provides) {
      if (!isValidCapability(capabilities, cap)) {
        errors.push(
          `${prefix} unknown capability in provides: "${cap}" (valid: ${validCapabilitiesList})`
        );
      }
    }
    for (const cap of card.requires) {
      if (!isValidCapability(capabilities, cap)) {
        errors.push(`${prefix} unknown capability in requires: "${cap}"`);
      }
    }
    for (const slotCap of Object.keys(card.deep.slots)) {
      if (!isValidCapability(capabilities, slotCap)) {
        errors.push(`${prefix} unknown capability in deep.slots: "${slotCap}"`);
      }
    }
    for (const proto of card.emits) {
      if (!isValidProtocol(protocols, proto)) {
        errors.push(`${prefix} unknown protocol in emits: "${proto}"`);
      }
    }
    for (const proto of card.consumes) {
      if (!isValidProtocol(protocols, proto)) {
        errors.push(`${prefix} unknown protocol in consumes: "${proto}"`);
      }
    }

    // Subagent resolution (subagentNames Set is hoisted above the loop)
    for (const subName of card.deep.subagents) {
      if (!subagentNames.has(subName)) {
        errors.push(`${prefix} unknown subagent in deep.subagents: "${subName}"`);
      }
    }

    // Path existence — core.files, deep.refs, deep.validators resolve to
    // brain/<skill>/<path> regardless of legacy source field.
    const brainRoot = resolve(root, "brain", card.skill);
    for (const p of [...card.core.files, ...card.deep.refs, ...card.deep.validators]) {
      const full = resolve(brainRoot, p);
      if (!existsSync(full)) {
        errors.push(`${prefix} path not found: brain/${card.skill}/${p}`);
      }
    }
  }

  // ── Protocols ────────────────────────────────────────────────────────────
  for (const proto of protocols) {
    const prefix = `[protocol:${proto.name}]`;
    if (!proto.hasSchema) errors.push(`${prefix} missing schema.json`);
    if (!proto.hasDoc) errors.push(`${prefix} missing protocol.md`);
    if (!proto.hasValidator) errors.push(`${prefix} missing validator.ts`);
    if (!proto.hasValidExamples) {
      errors.push(`${prefix} missing examples/valid/*.json (need at least one)`);
    }
    if (!proto.hasInvalidExamples) {
      errors.push(`${prefix} missing examples/invalid/*.json (need at least one)`);
    }
  }

  // ── Subagents ────────────────────────────────────────────────────────────
  for (const sub of subagents) {
    const prefix = `[subagent:${sub.name}]`;

    if (seenSubagentNames.has(sub.name)) {
      errors.push(`${prefix} duplicate subagent name`);
    }
    seenSubagentNames.add(sub.name);

    const stem = filenameStem(sub.filePath);
    if (sub.name !== stem) {
      errors.push(
        `${prefix} frontmatter name "${sub.name}" does not match filename "${stem}.md"`
      );
    }

    if (!sub.model) {
      errors.push(`${prefix} missing required frontmatter field: model`);
    } else if (!VALID_MODELS.includes(sub.model as (typeof VALID_MODELS)[number])) {
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
  }

  // ── Output ───────────────────────────────────────────────────────────────
  const cardCount = cards.length;
  const subCount = subagents.length;
  const protoCount = protocols.length;

  if (errors.length === 0) {
    if (warnings.length > 0) {
      process.stderr.write(`${warnings.length} warning(s):\n`);
      for (const w of warnings) process.stderr.write(`  ${w}\n`);
      process.stderr.write("\n");
    }
    process.stdout.write(
      `All ${cardCount} card(s), ${subCount} subagent(s), ${protoCount} protocol(s) valid.\n`
    );
    process.exit(0);
  }

  process.stderr.write(`${errors.length} error(s):\n`);
  for (const err of errors) {
    process.stderr.write(`  ${err}\n`);
  }
  if (warnings.length > 0) {
    process.stderr.write(`\n${warnings.length} warning(s):\n`);
    for (const w of warnings) process.stderr.write(`  ${w}\n`);
  }
  process.exit(1);
}
