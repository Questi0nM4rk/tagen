import type { LoadResult } from "../lib/catalog.ts";

const CLI_FAILURE_NAME = "CliFailure";

export function fail(message: string): never {
  const error = new Error(message);
  error.name = CLI_FAILURE_NAME;
  throw error;
}

export function failCatalogLoad(result: LoadResult): never {
  const messages = [...result.catalogErrors];
  for (const [card, errors] of result.frontmatterErrors) {
    for (const error of errors) messages.push(`${card}: ${error}`);
  }
  fail(messages.join("\n"));
}

export function isCliFailure(value: unknown): value is Error {
  return value instanceof Error && value.name === CLI_FAILURE_NAME;
}

export function reportCliFailure(error: Error): void {
  for (const message of error.message.split("\n")) {
    process.stderr.write(`tagen: ${message}\n`);
  }
}
