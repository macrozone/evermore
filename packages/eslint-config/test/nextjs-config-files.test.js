import assert from "node:assert/strict";
import { describe, it } from "node:test";

import nextjs from "../nextjs.js";
import { ruleIds } from "./lint.js";

// Separate test file (= separate process): typescript-eslint caches its
// project service per process, so the base preset's allowDefaultProject
// from presets.test.js would leak into this test.
describe("nextjs preset", () => {
  it("lints root-level config files included in the app tsconfig", async () => {
    assert.deepEqual(await ruleIds(nextjs, "nextjs", "next.config.ts"), []);
  });
});
