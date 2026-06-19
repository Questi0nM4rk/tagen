# Review Hardening and Typed Command Descriptors

## Current State

- Branch: `fix/review-hardening`
- Base: merged harness-agnostic `main`
- Do not touch or stage `.claude/worktrees/feat-tagen-root-override/`.
- Review hardening and the typed command-descriptor refactor are implemented.
- Full verification before delivery:
  - 166 tests passed
  - TypeScript 6.0.3 `tsc --noEmit` passed
  - TypeScript 7 native preview `tsgo --noEmit` passed
  - Biome passed across `src/`, `__tests__/`, `features/`, and `scripts/`
  - standalone and npm bundles printed `3.0.0`
  - codespell, markdownlint, publint, doc-count audit, and npm pack passed
  - extracted package binary and validator-runtime exports passed

## Implemented

- Embedded package version so the compiled binary no longer reads
  `/$bunfs/package.json`.
- `tagen add` now serializes frontmatter with the YAML library.
- Added CRLF frontmatter support.
- Reject symlinks anywhere under `brain/`.
- Report missing/non-file `CORE.md` and non-directory card entries.
- Scan harness leaks in large files; allowance prefixes now respect path
  boundaries.
- Normalize manifest paths to `/`.
- Make alias collision detection case-insensitive.
- Report all missing protocol components before returning.
- Validate JSON Schema input as `unknown` before compiling.
- Reject unknown/unsupported CLI flags and ignored positional arguments.
- Block composition when `requires:` names a nonexistent type.
- Block `list`/`get`/`add` on malformed catalog loading.
- Added strict compiler options and current dependencies.
- Added shared unknown-error handling.

## Command Descriptor Refactor

Replace the centralized command switch and command-name comparisons in
`src/main.ts` with typed command descriptors.

### Target Structure

```text
src/
├── cli/
│   ├── args.ts       # raw argv parsing only
│   ├── command.ts    # descriptor/context types
│   └── errors.ts     # CLI failure helpers
├── commands/
│   ├── index.ts      # typed descriptor registry
│   ├── add.ts
│   ├── get.ts
│   ├── list.ts
│   └── validate.ts
└── main.ts           # globals, descriptor lookup, context load, execute
```

### Descriptor Contract

Use a discriminated generic descriptor. Exact naming may vary, but preserve
these responsibilities:

```ts
type CatalogPolicy = "clean" | "diagnostic";
type PositionalPolicy = "allow" | "forbid";

interface ValueFlag<Name extends string> {
  readonly name: Name;
  readonly kind: "value";
  readonly repeatable: boolean;
}

interface BooleanFlag<Name extends string> {
  readonly name: Name;
  readonly kind: "boolean";
}

interface CommandDescriptor<Name extends string, Options> {
  readonly name: Name;
  readonly summary: string;
  readonly flags: readonly (ValueFlag<string> | BooleanFlag<string>)[];
  readonly positional: PositionalPolicy;
  readonly catalog: CatalogPolicy;
  decode(args: ParsedCommandArgs): Options;
  execute(context: CommandContext, options: Options): void | Promise<void>;
}
```

Improve the generics if useful, but do not build a framework. The goal is:

- adding a command requires adding one descriptor and one registry entry;
- each command owns its accepted flags and option decoding;
- `main.ts` never compares command names;
- `main.ts` has no command switch;
- raw strings exist only at the argv/parser boundary;
- descriptor option types make invalid execution states unrepresentable.

### Per-Command Ownership

- `list.ts`
  - flags: `--type` value, `--aliases` boolean, `--json` boolean
  - positional: forbid
  - catalog: clean
  - decoded options: existing `ListOptions`

- `get.ts`
  - flags: repeatable `--type`, `--name`, `--pin`; `--json`
  - positional: allow
  - catalog: clean
  - move `buildComposeQuery` here

- `validate.ts`
  - flag: `--verbose`
  - positional: forbid
  - catalog: diagnostic
  - malformed cards must be passed through for exhaustive reporting

- `add.ts`
  - no flags
  - positional: forbid
  - catalog: clean
  - descriptor derives `knownTypes` and calls existing `runAdd`

### Registry

`commands/index.ts` should export a readonly tuple or `Map` built from the
descriptors. Derive the command-name union from the descriptor tuple; do not
repeat a handwritten command-name union.

### Main

`main.ts` should only:

1. Handle no args / global help.
2. Handle global version.
3. Resolve a descriptor from the registry.
4. Parse remaining argv using that descriptor's flag definitions.
5. Load the catalog once.
6. Enforce descriptor `catalog` policy generically.
7. Decode options through the descriptor.
8. Execute the descriptor.

Help output should be generated from descriptor metadata where practical.
Avoid moving the existing hardcoded help into another centralized table.

## Tests to Add or Update

- Parser unit tests:
  - unknown option
  - missing value
  - repeated non-repeatable flag
  - repeated repeatable flag
  - forbidden positional argument
- Registry test:
  - command names are unique
  - every command contributes help metadata
- Existing CLI behavior remains unchanged.
- Existing malformed-catalog `list` test remains green.
- Add equivalent malformed-catalog coverage for `get` or test the generic
  clean-catalog policy directly.
- Verify `validate` still receives malformed catalog state and reports all
  violations.

## Type and Minimality Constraints

- Keep `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `isolatedModules`, `erasableSyntaxOnly`, unused checks, and both compilers.
- No `any`.
- Avoid `as` assertions except the public generic `readPayload<T>()` boundary.
- Prefer `satisfies` and const tuples to duplicated string unions.
- No classes, decorators, dependency injection, or command base class.
- Do not introduce a third-party CLI parser.
- Keep command implementations callable directly by existing unit tests.
- Split only by responsibility; do not create one-line wrapper modules.

## Final Audit

After the descriptor refactor:

```bash
bun run prepublishOnly
bun run lint
bun run build
./bin/tagen --version
codespell --skip='*.lock,bin/*,node_modules' .
git ls-files '*.md' | xargs bunx markdownlint-cli2
bunx publint
npm pack --dry-run --json --cache /tmp/tagen-npm-cache
git diff --check
```

Also extract the package tarball and verify:

```bash
<extracted>/package/bin/tagen.js --version
bun -e 'const m = await import(process.argv[1]); console.log(Object.keys(m))' \
  <extracted>/package/src/validator-runtime.ts
```

Expected final test count is at least 157 plus command-parser/registry tests.

## Delivery

1. Review the complete diff for unnecessary abstractions.
2. Commit on `fix/review-hardening`.
3. Fetch and rebase onto current `origin/main`.
4. Rerun the full verification.
5. Push the branch.
6. Open a PR summarizing confirmed bugs fixed and type/tooling hardening.
7. Do not admin-merge unless explicitly authorized.
