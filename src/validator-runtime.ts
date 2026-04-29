/**
 * tagen validator-runtime — shared helpers for protocol and card validators.
 *
 * Validators (e.g. skill-graph/protocols/<name>/validator.ts and
 * brain/<module>/validators/*.ts) read a JSON payload from stdin, exit 0 on
 * pass, exit 1 on fail (writing one violation per line to stderr).
 *
 * Import as: `import { readPayload, pass, fail } from "@questi0nm4rk/tagen/validator-runtime";`
 */

/** Read JSON payload from stdin. Exits 1 with a clear error if stdin is empty or invalid JSON. */
export async function readPayload<T = unknown>(): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    process.stderr.write("validator: empty stdin payload\n");
    process.exit(1);
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    process.stderr.write(
      `validator: invalid JSON on stdin: ${(err as Error).message}\n`
    );
    process.exit(1);
  }
}

/** Exit 0 — validator passes. */
export function pass(): never {
  process.exit(0);
}

/** Exit 1 + write violations to stderr (one per line). */
export function fail(violations: string[]): never {
  for (const v of violations) {
    process.stderr.write(`${v}\n`);
  }
  process.exit(1);
}
