# TypeScript Review Rules

Use this guide for `*.ts`, `*.tsx`, `*.mts`, and `*.cts`.

## Reject If

- `any` is introduced without a narrow, documented reason.
- Exported functions, public methods, or complex helpers rely on implicit return types where the contract becomes unclear.
- Type assertions (`as Foo`) bypass real validation instead of narrowing unknown data.
- `enum` is used for app-level domain modeling when `as const` objects or unions are sufficient.
- Unvalidated API, storage, or URL data is treated as trusted application data.
- Errors are swallowed and replaced with vague fallback behavior.

## Require

- Explicit types at module boundaries: exported functions, public interfaces, config objects, external adapters.
- Narrowing for `unknown` input before use.
- Meaningful names for types (`UserProfile`, `ApiErrorResponse`, `SearchFilters`).
- Discriminated unions for state machines and async states where applicable.
- Error messages that preserve context without leaking secrets.

## Prefer

- `satisfies` over broad assertions.
- `unknown` over `any` for untrusted values.
- Named exports over default exports.
- Small utility functions over giant multi-branch procedures.
- Immutable updates over in-place mutation.

## Security Checks

- Verify that browser-exposed code does not contain secrets in `process.env`, `import.meta.env`, or config literals.
- Verify that HTML rendering paths do not convert untrusted strings into executable markup.
- Verify that URL params, storage values, and API responses are validated before use.