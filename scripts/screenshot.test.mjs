import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

const run = (...args) => spawnSync(process.execPath, ["scripts/screenshot.mjs", ...args], { encoding: "utf8" });

test("help works without a server or installed browser", () => {
  assert.match(execFileSync(process.execPath, ["scripts/screenshot.mjs", "--help"], { encoding: "utf8" }), /Usage: pnpm screenshot/);
});

test("rejects external URLs, non-lab paths and invalid capture options before startup", () => {
  for (const args of [[], ["https://example.com/lab"], ["//example.com/lab"], ["/"], ["/laboratory"], ["/lab", "--wait", "-1"], ["/lab", "--wait", "NaN"], ["/lab", "--wait", "120001"], ["/lab", "--out", "capture.jpg"], ["/lab", "/lab/world"]]) {
    const result = run(...args);
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.match(result.stderr, /\[screenshot\]/);
    assert.doesNotMatch(result.stdout, /ensure-base-port|Starting|Reusing/);
  }
});
