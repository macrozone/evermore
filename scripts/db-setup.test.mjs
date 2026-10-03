import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
function fixture(t, failAt) {
  const dir = mkdtempSync(path.join(root, ".db-setup-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const subdir of ["scripts", "apps/local-development", "bin"]) {
    mkdirSync(path.join(dir, subdir), { recursive: true });
  }
  copyFileSync(path.join(root, "scripts/db-setup.mjs"), path.join(dir, "scripts/db-setup.mjs"));
  const mock = `#!${process.execPath}
import fs from "node:fs";
const args = process.argv.slice(2);
fs.appendFileSync("calls.jsonl", JSON.stringify({args, url:process.env.DATABASE_URL, port:process.env.DB_PORT, project:process.env.COMPOSE_PROJECT_NAME})+"\\n");
if (args.at(-1) === process.env.FAIL_AT) process.exit(1);
if (args[0] === "catenv") fs.writeFileSync("apps/local-development/.env", "DB_PORT=6830\\nCOMPOSE_PROJECT_NAME=evermore-6800\\n");
`;
  writeFileSync(path.join(dir, "bin/pnpm"), mock, { mode: 0o755 });
  const result = spawnSync(process.execPath, [path.join(dir, "scripts/db-setup.mjs")], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}`, FAIL_AT: failAt ?? "",
      DATABASE_URL: "postgresql://production.invalid/prod", DB_PORT: "3030", COMPOSE_PROJECT_NAME: "foreign-project" },
  });
  const calls = readFileSync(path.join(dir, "calls.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  return { result, calls };
}

test("setup uses generated worktree ports and local URL for every database step", (t) => {
  const { result, calls } = fixture(t);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls.map(({ args }) => args.at(-1)), ["catenv", "services:up", "build", "migrate", "seed", "test:integration"]);
  for (const call of calls.slice(1)) {
    assert.equal(call.url, "postgresql://evermore:evermore@localhost:6830/evermore");
    assert.equal(call.port, "6830");
    assert.equal(call.project, "evermore-6800");
  }
});

for (const failedStep of ["services:up", "migrate"]) {
  test(`setup stops immediately when ${failedStep} fails`, (t) => {
    const { result, calls } = fixture(t, failedStep);
    assert.notEqual(result.status, 0);
    assert.equal(calls.at(-1).args.at(-1), failedStep);
    assert.ok(!calls.some(({ args }) => args.at(-1) === "seed"));
  });
}
