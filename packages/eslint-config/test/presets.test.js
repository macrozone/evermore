import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { ESLint } from "eslint";

import base from "../base.js";
import nextjs from "../nextjs.js";

const fixtures = path.join(import.meta.dirname, "fixtures");

/**
 * Lints a fixture file with the given preset and returns the rule ids
 * of all reported problems (fatal parse/config errors fail the test).
 *
 * @param {import("eslint").Linter.Config[]} preset
 * @param {string} fixture fixture project directory
 * @param {string} file file path relative to the fixture project
 */
async function ruleIds(preset, fixture, file) {
  const cwd = path.join(fixtures, fixture);
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: preset,
  });
  const [result] = await eslint.lintFiles([file]);
  assert.ok(result, `no lint result for ${file}`);
  const fatal = result.messages.filter((message) => message.fatal === true);
  assert.deepEqual(fatal, [], `fatal lint errors in ${file}`);
  return result.messages.map((message) => message.ruleId);
}

describe("base preset", () => {
  it("accepts clean TypeScript", async () => {
    assert.deepEqual(await ruleIds(base, "library", "src/clean.ts"), []);
  });

  it("reports type imports, falsy-zero checks and floating promises", async () => {
    const ids = await ruleIds(base, "library", "src/violations.ts");
    assert.ok(ids.includes("@typescript-eslint/consistent-type-imports"));
    assert.ok(ids.includes("@typescript-eslint/strict-boolean-expressions"));
    assert.ok(ids.includes("@typescript-eslint/no-floating-promises"));
  });
});

describe("nextjs preset", () => {
  it("accepts a clean React component", async () => {
    assert.deepEqual(await ruleIds(nextjs, "nextjs", "app/clean.tsx"), []);
  });

  it("applies Next.js, React Hooks and type-aware rules to TSX", async () => {
    const ids = await ruleIds(nextjs, "nextjs", "app/violations.tsx");
    assert.ok(ids.includes("@next/next/no-img-element"));
    assert.ok(ids.includes("react-hooks/rules-of-hooks"));
    assert.ok(ids.includes("@typescript-eslint/strict-boolean-expressions"));
  });
});
