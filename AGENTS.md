# Code Review Rules

## Skill Index

| Trigger (file pattern) | Skill      | Location                    |
| ---------------------- | ---------- | --------------------------- |
| `*.ts`, `*.tsx`        | TypeScript | `docs/skills/typescript.md` |
| `*.tsx`, `*.jsx`       | React      | `docs/skills/react.md`      |

---

## General Rules (always active)

REJECT if:

- Hardcoded secrets or credentials
- `console.log` / `print()` in production code
- Empty catch/except blocks (silent error swallowing)
- Code duplication (DRY violation)
- Missing error handling

REQUIRE:

- Descriptive variable and function names
- Error messages that help debugging

## Response Format

FIRST LINE must be exactly:
STATUS: PASSED
or
STATUS: FAILED

If FAILED, list: `file:line - rule violated - issue`
