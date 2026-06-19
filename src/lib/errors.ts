export function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
