import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const script = fileURLToPath(new URL('./ensure-base-port.ts', import.meta.url));
test('main checkout and sibling worktrees keep separate, persistent slots', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evermore-ports-'));
  const main = path.join(dir, 'main');
  fs.mkdirSync(main);
  const git = (...args) => execFileSync('git', args, { cwd: main, stdio: 'pipe' });
  const env = { ...process.env };
  delete env.BASE_PORT;
  const run = (cwd, extra = {}) => {
    const result = spawnSync(process.execPath, ['--experimental-strip-types', script], { cwd, env: { ...env, ...extra }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return Number(fs.readFileSync(path.join(cwd, '.env.local'), 'utf8').match(/^BASE_PORT=(\d+)$/m)[1]);
  };
  let server;
  try {
    git('init');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'fixture');
    const first = path.join(dir, 'first worktree');
    const second = path.join(dir, 'second');
    git('worktree', 'add', '--detach', first);
    git('worktree', 'add', '--detach', second);
    assert.equal(run(main), 3000);
    fs.writeFileSync(path.join(first, '.env.local'), 'UNRELATED=keep\n');
    const firstPort = run(first);
    assert.ok(firstPort >= 4000 && firstPort <= 9900 && firstPort % 100 === 0);
    assert.equal(run(first), firstPort);
    assert.match(fs.readFileSync(path.join(first, '.env.local'), 'utf8'), /UNRELATED=keep/);
    // Force the second worktree's hash-selected range to be reserved by a
    // stopped sibling; allocation must advance even without listeners.
    const secondPort = run(second);
    assert.notEqual(secondPort, firstPort);
    fs.writeFileSync(path.join(first, '.env.local'), `BASE_PORT=${secondPort}\n`);
    fs.unlinkSync(path.join(second, '.env.local'));
    assert.notEqual(run(second), secondPort);
    // A listening range is skipped, but an existing assignment stays stable.
    server = net.createServer();
    await new Promise((resolve, reject) => server.once('error', reject).listen(firstPort, resolve));
    fs.writeFileSync(path.join(first, '.env.local'), `BASE_PORT=${firstPort}\n`);
    assert.equal(run(first), firstPort);
    fs.unlinkSync(path.join(first, '.env.local'));
    assert.notEqual(run(first), firstPort);
    assert.equal(run(first, { BASE_PORT: '12000' }), 12000);
    const invalid = spawnSync(process.execPath, ['--experimental-strip-types', script], { cwd: first, env: { ...env, BASE_PORT: 'NaN' }, encoding: 'utf8' });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /BASE_PORT must be an integer/);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
