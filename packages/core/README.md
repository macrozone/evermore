# @evermore/core

Domänenneutrale Business-Logik, die Apps (`apps/www`) und künftige Services teilen.
Kein Framework-Code (React, Next.js, Datenbank) – nur Typen und reine Funktionen.

Das Package wird **ohne Build-Schritt** als TypeScript-Quelle konsumiert
(`exports` zeigt auf `src/index.ts`). Next.js-Apps tragen es deshalb in
`transpilePackages` ein (siehe `apps/www/next.config.ts`).

```ts
import { getGameInfo } from "@evermore/core";
```

Tests liegen neben dem Code (`src/**/*.test.ts`) und laufen mit Vitest:
`pnpm --filter @evermore/core test`.
