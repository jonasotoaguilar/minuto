# TypeScript Review Rules

REJECT if:

- `any` type without `// @ts-expect-error` justification
- Missing return types on exported functions
- Type assertions (`as X`) without comment explaining why
- `enum` used → use `as const` objects instead

PREFER:

- Discriminated unions over type guards
- `satisfies` over type assertions
- Named exports over default exports
