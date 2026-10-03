# @evermore/eslint-config

Shared ESLint flat configs (ESLint 9, typescript-eslint).

- `@evermore/eslint-config/base` – libraries and services (`packages/*`)
- `@evermore/eslint-config/nextjs` – Next.js apps (base + React, React Hooks, `@next/next` core web vitals)

TypeScript files are linted with type information (`projectService`, nearest `tsconfig.json`).
This includes `strict-boolean-expressions` (no truthiness checks on numbers/strings),
`no-floating-promises` and `no-misused-promises`.

## Usage in a package

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
import base from "@evermore/eslint-config/base"; // or /nextjs
export default base;
```

```json
// tsconfig.json
{ "extends": "@evermore/tsconfig/base.json" }
```

Next.js apps extend `@evermore/tsconfig/nextjs.json` and add `include`
(`next-env.d.ts`, `**/*.ts`, `**/*.tsx`, `.next/types/**/*.ts`).
Since `next.config.ts` is then part of the project too, the `nextjs` preset
does without `allowDefaultProject`: every TS file of the app must be covered by `tsconfig.json`.

TypeScript 6 sets `types` to `[]` by default: if you use Node APIs, add
`"types": ["node"]` (and `@types/node` from `catalog:typescript-types`).
