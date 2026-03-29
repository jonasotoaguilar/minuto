# React Review Rules

REJECT if:

- `import React` → use named imports `import { useState }`
- `useMemo`/`useCallback` without justification (React 19 Compiler handles this)
- Missing `"use client"` directive in client components
- Props drilling more than 2 levels deep

PREFER:

- Composition over inheritance
- Semantic HTML (`<section>`, `<article>`) over generic `<div>`
- Colocated files (component + test + styles in same directory)
