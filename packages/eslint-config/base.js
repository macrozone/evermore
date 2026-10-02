import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Base config for libraries and services (packages/*, non-Next apps).
 *
 * Usage in eslint.config.js:
 *   import base from "@evermore/eslint-config/base";
 *   export default base;
 */
export default defineConfig(
  globalIgnores([
    "**/node_modules/",
    "**/dist/",
    "**/.next/",
    "**/.turbo/",
    "**/coverage/",
    "**/generated/",
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Type-aware rules only for TS sources, so plain JS config files
    // (eslint.config.js etc.) need not be part of a tsconfig project.
    // The project service picks the nearest tsconfig.json per file.
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parserOptions: {
        projectService: {
          // root-level config files (vitest.config.ts, …) are usually
          // outside the package tsconfig
          allowDefaultProject: ["*.ts", "*.mts"],
        },
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      // Truthiness checks on numbers/strings treat a legitimate 0 or ""
      // as absent – presence checks must be explicit (`value == null`).
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: true,
          allowNullableBoolean: true,
        },
      ],
    },
  },
);
