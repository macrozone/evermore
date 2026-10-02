import assert from "node:assert/strict";
import path from "node:path";

import { ESLint } from "eslint";

const fixtures = path.join(import.meta.dirname, "fixtures");

/**
 * Lints a fixture file with the given preset and returns the rule ids
 * of all reported problems (fatal parse/config errors fail the test).
 *
 * @param {import("eslint").Linter.Config[]} preset
 * @param {string} fixture fixture project directory
 * @param {string} file file path relative to the fixture project
 */
export async function ruleIds(preset, fixture, file) {
  const cwd = path.join(fixtures, fixture);
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [
      ...preset,
      // resolve allowDefaultProject globs against the fixture like an
      // ESLint run from inside the package would
      { languageOptions: { parserOptions: { tsconfigRootDir: cwd } } },
    ],
  });
  const [result] = await eslint.lintFiles([file]);
  assert.ok(result, `no lint result for ${file}`);
  const fatal = result.messages.filter((message) => message.fatal === true);
  assert.deepEqual(fatal, [], `fatal lint errors in ${file}`);
  return result.messages.map((message) => message.ruleId);
}
