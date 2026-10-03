# @evermore/core

Domain-neutral business logic shared by apps (`apps/www`) and future services.
No framework code (React, Next.js, database) – only types and pure functions.

The package is consumed as TypeScript source **without a build step**
(`exports` points to `src/index.ts`). Next.js apps therefore list it in
`transpilePackages` (see `apps/www/next.config.ts`).

```ts
import { getGameInfo } from "@evermore/core";
```

Tests live next to the code (`src/**/*.test.ts`) and run with Vitest:
`pnpm --filter @evermore/core test`.
