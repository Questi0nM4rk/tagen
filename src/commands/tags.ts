import { allCapabilities } from "../lib/capabilities";
import { allProtocolNames } from "../lib/protocols";
import type {
  CapabilityRegistry,
  ProtocolEntry,
  Subagent,
  Vocabulary,
} from "../lib/types";

/**
 * Print all four controlled vocabularies — tag dimensions, capabilities,
 * protocols, and the subagent registry — per SPEC-tagen "tagen tags".
 *
 * --json emits one object combining all four; the human form prints
 * dimensioned sections in order.
 */
export function runTags(
  vocab: Vocabulary,
  capabilities: CapabilityRegistry,
  protocols: ProtocolEntry[],
  subagents: Subagent[],
  json: boolean
): void {
  if (json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          tags: vocab.dimensions,
          capabilities: capabilities.capabilities,
          protocols: allProtocolNames(protocols),
          subagents: subagents.map((s) => ({
            name: s.name,
            model: s.model,
            description: s.description,
          })),
        },
        null,
        2
      )}\n`
    );
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

  process.stdout.write("\ncapabilities\n");
  const caps = allCapabilities(capabilities);
  if (caps.length === 0) {
    process.stdout.write("  (none registered)\n");
  } else {
    for (const cap of caps) {
      const desc = capabilities.capabilities[cap] ?? "";
      process.stdout.write(`  ${cap.padEnd(28)} ${desc}\n`);
    }
  }

  process.stdout.write("\nprotocols\n");
  if (protocols.length === 0) {
    process.stdout.write("  (none registered)\n");
  } else {
    for (const p of protocols) {
      const flags: string[] = [];
      if (!p.hasSchema) flags.push("no-schema");
      if (!p.hasValidator) flags.push("no-validator");
      if (!p.hasValidExamples) flags.push("no-valid-examples");
      const tag = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
      process.stdout.write(`  ${p.name.padEnd(28)}${tag}\n`);
    }
  }

  process.stdout.write("\nsubagents\n");
  if (subagents.length === 0) {
    process.stdout.write("  (none registered)\n");
  } else {
    for (const s of subagents) {
      process.stdout.write(
        `  ${s.name.padEnd(28)} ${s.model.padEnd(8)} ${s.description}\n`
      );
    }
  }

  process.stdout.write("\n");
}
