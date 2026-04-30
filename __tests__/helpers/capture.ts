/**
 * Capture process.stdout / process.stderr writes from a synchronous block.
 *
 * Used by command-level tests that exercise the `run<Cmd>(...)` entrypoints,
 * which write directly to the process streams. Restores the originals on
 * normal completion AND on throw — tests that rely on process.exit are
 * intentionally not handled here; use the async variant if needed.
 */
export function captureStdout(fn: () => void): string {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((c: string | Uint8Array) => {
    chunks.push(typeof c === "string" ? c : Buffer.from(c).toString("utf8"));
    return true;
  }) as typeof process.stdout.write;
  try {
    fn();
  } finally {
    process.stdout.write = original;
  }
  return chunks.join("");
}

export function captureStderr(fn: () => void): string {
  const chunks: string[] = [];
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((c: string | Uint8Array) => {
    chunks.push(typeof c === "string" ? c : Buffer.from(c).toString("utf8"));
    return true;
  }) as typeof process.stderr.write;
  try {
    fn();
  } finally {
    process.stderr.write = original;
  }
  return chunks.join("");
}

export function captureBoth(fn: () => void): { stdout: string; stderr: string } {
  const out: string[] = [];
  const err: string[] = [];
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((c: string | Uint8Array) => {
    out.push(typeof c === "string" ? c : Buffer.from(c).toString("utf8"));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((c: string | Uint8Array) => {
    err.push(typeof c === "string" ? c : Buffer.from(c).toString("utf8"));
    return true;
  }) as typeof process.stderr.write;
  try {
    fn();
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
  return { stdout: out.join(""), stderr: err.join("") };
}
