# Code Review Rules

## Review Goals

Every review must optimize for:

1. **Correctness** — the code must work for happy path and edge cases.
2. **Security** — no secrets, no unsafe sinks, no trust in unvalidated input.
3. **Maintainability** — readable names, small units, low duplication.
4. **Operational safety** — clear errors, bounded behavior, sensible defaults.

## Skill Directory

Load the most relevant skill documents based on the touched files and review context.

| Trigger                                                                         | Skill              | Path                        |
| ------------------------------------------------------------------------------- | ------------------ | --------------------------- |
| `*.ts`, `*.tsx`, `*.mts`, `*.cts`                                               | TypeScript         | `docs/skills/typescript.md` |
| `*.tsx`, `*.jsx`                                                                | React              | `docs/skills/react.md`      |
| `*.css`, `*.scss`, `tailwind.config.*`, `className=`, `class=`                  | Tailwind / Styling | `docs/skills/tailwind.md`   |

## Global Rules (always active)

REJECT if:

- Hardcoded secrets, credentials, tokens, private keys, or connection strings with embedded secrets.
- Trusting user-controlled input without validation, sanitization, or allowlisting where required.
- Dangerous code execution or injection patterns:
  - `eval`, `new Function`, string-based timers
  - `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML` with untrusted data
  - shell execution built from untrusted input
- Empty `catch` / `except` / ignored errors / silent fallbacks that hide failures.
- Missing authz checks on privileged actions.
- Broad wildcard security bypasses such as permissive CORS + credentials, `InsecureSkipVerify`, or disabling checksum/security controls without documented reason.
- Logging sensitive data or dumping full configs/env vars.

REQUIRE:

- Descriptive variable, function, component, and file names.
- Errors that preserve debugging value without leaking secrets.
- Small, composable units instead of giant multi-purpose functions (max 50 lines per function).
- Clear input/output contracts for exported functions and modules.
- Consistent formatting and structure.
- Evidence-based review comments: cite file and line, and explain WHY it matters.

## Review Workflow

1. Identify touched languages and load the matching skill docs from `docs/skills/`.
2. Review security-critical surfaces first:
   - auth/session handling
   - untrusted input
   - HTML/DOM rendering
   - external commands, queries, network calls
   - secrets/config
3. Review correctness and error handling.
4. Review maintainability and duplication.
5. Review tests and operational impact.

## Response Format

The first line MUST be exactly one of:

```text
STATUS: PASSED
STATUS: FAILED
```

If the review fails, list findings in this exact format:

```text
path/to/file:line - rule violated - why it matters
```

## Severity Heuristic

- **Blocker**: security issue, data loss, broken behavior, or missing critical validation.
- **Major**: maintainability or correctness issue likely to produce bugs soon.
- **Minor**: readability, consistency, or design improvement that should be addressed but is not immediately dangerous.
