import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig, globalIgnores } from "eslint/config";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";

import base from "./base.js";

const { recommended: reactRecommended, "jsx-runtime": reactJsxRuntime } =
  reactPlugin.configs.flat;
if (!reactRecommended || !reactJsxRuntime) {
  throw new Error("eslint-plugin-react does not provide its flat configs");
}

/**
 * Config for Next.js apps (apps/www, …): base + React, React Hooks and
 * Next.js core web vitals rules.
 *
 * The plugins are used directly instead of eslint-config-next, whose
 * parser requires `next` to be resolvable from the config package.
 *
 * Usage in eslint.config.js:
 *   import nextjs from "@evermore/eslint-config/nextjs";
 *   export default nextjs;
 */
export default defineConfig(
  base,
  globalIgnores(["**/next-env.d.ts"]),
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    extends: [
      reactRecommended,
      reactJsxRuntime,
      reactHooksPlugin.configs.flat.recommended,
      nextPlugin.configs["core-web-vitals"],
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      react: { version: "detect" },
    },
  },
);
