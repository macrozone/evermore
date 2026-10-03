import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createDevIndex } from '../apps/dev-index/server.mjs';

const generate = fileURLToPath(new URL('./write-claude-launch-config.mjs', import.meta.url));
const print = fileURLToPath(new URL('./print-dev-urls.mjs', import.meta.url));

test('preview generation and startup output follow the checkout port and regenerate after a slot change', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evermore-dev-'));
  try {
    // Main checkout, linked worktree, then a changed explicit slot.
    for (const base of [3000, 5100, 12000]) {
      fs.writeFileSync(path.join(dir, '.env.local'), `BASE_PORT=${base}\n`);
      const env = { ...process.env };
      delete env.BASE_PORT;
      const run = (script) => spawnSync(process.execPath, ['--env-file=.env.local', script], { cwd: dir, env, encoding: 'utf8' });
      const generated = run(generate);
      assert.equal(generated.status, 0, generated.stderr);
      const launch = JSON.parse(fs.readFileSync(path.join(dir, '.claude/launch.json'), 'utf8'));
      assert.equal(launch.version, '0.0.1');
      assert.equal(launch.configurations.length, 1);
      const config = launch.configurations[0];
      assert.equal(config.name, 'www');
      assert.equal(config.port, base);
      assert.equal(config.env.BASE_PORT, String(base));
      assert.equal(config.autoPort, false);
      assert.equal(config.cwd, '.');
      assert.equal(config.runtimeExecutable, 'pnpm');
      assert.deepEqual(config.runtimeArgs, ['dev']);
      const output = run(print);
      assert.equal(output.status, 0, output.stderr);
      for (const offset of [0, 30, 31, 90]) assert.ok(output.stdout.includes(`localhost:${base + offset}`));
      assert.ok(output.stdout.includes(`http://localhost:${base}/lab`));
    }
    const invalid = spawnSync(process.execPath, [generate], { cwd: dir, env: { ...process.env, BASE_PORT: 'NaN' }, encoding: 'utf8' });
    assert.notEqual(invalid.status, 0);
    // Invalid input must not replace a valid preview configuration.
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '.claude/launch.json'), 'utf8')).configurations[0].port, 12000);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('dev index serves worktree-specific links and service addresses over HTTP', async () => {
  const server = createDevIndex(5100);
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(origin);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    const html = await response.text();
    for (const route of ['', '/lab', '/moodboards']) assert.ok(html.includes(`href="http://localhost:5100${route}"`));
    for (const port of [5130, 5131]) assert.ok(html.includes(`localhost:${port}`));
    assert.equal((await fetch(`${origin}/missing`)).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
