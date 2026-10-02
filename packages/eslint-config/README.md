# @evermore/eslint-config

Gemeinsame ESLint-Flat-Configs (ESLint 9, typescript-eslint).

- `@evermore/eslint-config/base` – Libraries und Services (`packages/*`)
- `@evermore/eslint-config/nextjs` – Next.js-Apps (base + React, React Hooks, `@next/next` core web vitals)

TypeScript-Dateien werden typbasiert gelintet (`projectService`, nächstes `tsconfig.json`).
Dazu gehören `strict-boolean-expressions` (keine Truthiness-Checks auf Zahlen/Strings),
`no-floating-promises` und `no-misused-promises`.

## Verwendung in einem Package

```jsonc
// package.json
"scripts": { "lint": "eslint .", "typecheck": "tsc" },
"devDependencies": {
  "@evermore/eslint-config": "workspace:*",
  "@evermore/tsconfig": "workspace:*",
  "eslint": "catalog:linting",
  "typescript": "catalog:build-tools"
}
```

```js
// eslint.config.js
import base from "@evermore/eslint-config/base"; // bzw. /nextjs
export default base;
```

```json
// tsconfig.json
{ "extends": "@evermore/tsconfig/base.json" }
```

Next.js-Apps erweitern `@evermore/tsconfig/nextjs.json` und ergänzen `include`
(`next-env.d.ts`, `**/*.ts`, `**/*.tsx`, `.next/types/**/*.ts`).

TypeScript 6 setzt `types` standardmässig auf `[]`: wer Node-APIs nutzt, ergänzt
`"types": ["node"]` (und `@types/node` aus `catalog:typescript-types`).
