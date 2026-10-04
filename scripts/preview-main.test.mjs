import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const implementation = fs.readFileSync(new URL('./preview-main.mjs', import.meta.url));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

async function fixture(t, withDb = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evermore-preview-'));
  const remote = path.join(dir, 'remote.git');
  const source = path.join(dir, 'source');
  const preview = path.join(dir, 'preview with spaces');
  const bin = path.join(dir, 'bin');
  const callsFile = path.join(dir, 'calls.jsonl');
  fs.mkdirSync(source); fs.mkdirSync(bin);
  git(dir, 'init', '--bare', remote);
  git(source, 'init', '-b', 'main');
  git(source, 'config', 'user.email', 'test@example.com');
  git(source, 'config', 'user.name', 'Preview Test');
  fs.mkdirSync(path.join(source, 'scripts'));
  fs.writeFileSync(path.join(source, 'scripts/preview-main.mjs'), implementation);
  fs.writeFileSync(path.join(source, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  fs.writeFileSync(path.join(source, '.gitignore'), 'node_modules\n.env.local\n');
  fs.writeFileSync(path.join(source, 'page.txt'), 'first main');
  const writePackage = (db) => fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({ scripts: db ? { 'db:setup': 'stub' } : {} }));
  writePackage(withDb);
  const publish = () => { git(source, 'add', '.'); git(source, 'commit', '-m', 'Update main'); git(source, 'push', remote, 'main'); };
  publish();
  git(source, 'remote', 'add', 'origin', remote);
  let port;
  do {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
  } while (port > 65436);
  fs.writeFileSync(path.join(bin, 'dev-child.cjs'), `
const fs = require('node:fs');
const path = require('node:path');
const app = 'apps/www/app';
const routes = fs.existsSync(app) ? fs.readdirSync(app, {recursive:true}).filter(file => /\\/(page|route)\\.(tsx?|jsx?)$/.test(file)).map(file => '/'+path.dirname(file)) : [];
if (process.env.TEST_IGNORE_TERM) process.on('SIGTERM', () => {});
require('node:http').createServer((req,res)=> {
  if (req.url !== '/' && !routes.includes(req.url)) { res.statusCode = 404; res.end('missing route'); }
  else res.end(fs.readFileSync('page.txt'));
}).listen(Number(process.env.TEST_STUB_PORT));
`);
  fs.writeFileSync(path.join(bin, 'pnpm'), `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_CALLS, JSON.stringify({args, cwd:process.cwd(), port:process.env.BASE_PORT, db:process.env.DATABASE_URL})+'\\n');
if (process.env.TEST_FAIL === args.at(-1)) process.exit(7);
if (args[0] === 'install') fs.mkdirSync('node_modules', {recursive:true});
if (args[0] === 'catenv') fs.writeFileSync('.env.local', 'BASE_PORT='+process.env.BASE_PORT+'\\n');
if (args[0] === 'dev') {
  const spawn = require('node:child_process').spawn;
  const childScript = path.join(__dirname, 'dev-child.cjs');
  spawn(process.execPath, [childScript], {detached:process.env.TEST_DETACHED === '1', stdio:'ignore', env:{...process.env, TEST_STUB_PORT:process.env.BASE_PORT}});
  if (process.env.TEST_DETACHED === '1') spawn(process.execPath, [childScript], {detached:true, stdio:'ignore', env:{...process.env, TEST_STUB_PORT:String(Number(process.env.BASE_PORT)+90)}});
  setInterval(() => {}, 1000);

}
`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, PREVIEW_MAIN_DIR: preview, PREVIEW_MAIN_PORT: String(port), TEST_CALLS: callsFile, BASE_PORT: '9100', DATABASE_URL: 'postgresql://production/unsafe' };
  const run = (command, overrides = {}) => spawnSync(process.execPath, [path.join(source, 'scripts/preview-main.mjs'), command], { env: { ...env, ...overrides }, encoding: 'utf8', timeout: 20000 });
  const calls = () => fs.existsSync(callsFile) ? fs.readFileSync(callsFile, 'utf8').trim().split('\n').map(JSON.parse) : [];
  const state = () => JSON.parse(fs.readFileSync(path.join(git(preview, 'rev-parse', '--absolute-git-dir'), 'preview-main.json'), 'utf8'));
  t.after(() => {
    if (fs.existsSync(preview)) run('stop');
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const writeState = (value) => fs.writeFileSync(path.join(git(preview, 'rev-parse', '--absolute-git-dir'), 'preview-main.json'), JSON.stringify(value));
  const route = (file, content = 'export default function Page() {}') => {
    const target = path.join(source, 'apps/www/app', file);
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.writeFileSync(target, content);
  };
  return { source, preview, port, run, calls, state, writeState, publish, writePackage, route };
}
const request = (url, options = {}) => fetch(url, { signal: AbortSignal.timeout(2000), ...options, headers: { connection: 'close' } });
const passed = (result) => assert.equal(result.status, 0, result.stdout + result.stderr);

test('start and update keep a detached preview and a single running server while main changes', async (t) => {
  const f = await fixture(t);
  passed(f.run('start'));
  const pid = f.state().pid;
  assert.equal(await (await request(`http://localhost:${f.port}`)).text(), 'first main');
  assert.equal(git(f.preview, 'branch', '--show-current'), '');
  assert.equal(git(f.source, 'branch', '--show-current'), 'main');
  fs.mkdirSync(path.join(f.preview, '.claude/skills/catladder-cli'), { recursive: true });
  fs.writeFileSync(path.join(f.preview, '.claude/skills/catladder-cli/SKILL.md'), 'Generated by catenv');
  passed(f.run('start'));
  assert.equal(f.state().pid, pid);
  assert.equal(f.calls().filter(({ args }) => args[0] === 'dev').length, 1);
  assert.equal(f.calls().filter(({ args }) => args[0] === 'install').length, 1);
  assert.equal(f.calls().filter(({ args }) => args[0] === 'db:setup').length, 1);
  fs.writeFileSync(path.join(f.source, 'page.txt'), 'new main');
  f.publish();
  passed(f.run('update'));
  assert.equal(f.state().pid, pid);
  assert.equal(git(f.preview, 'rev-parse', 'HEAD'), git(f.source, 'rev-parse', 'HEAD'));
  assert.equal(await (await request(`http://localhost:${f.port}`)).text(), 'new main');
  assert.equal(f.calls().filter(({ args }) => args[0] === 'install').length, 1);
  fs.appendFileSync(path.join(f.source, 'pnpm-lock.yaml'), '# dependency change\n');
  f.publish();
  passed(f.run('update'));
  passed(f.run('update'));
  assert.equal(f.calls().filter(({ args }) => args[0] === 'install').length, 2);
  for (const call of f.calls()) {
    assert.equal(fs.realpathSync(call.cwd), fs.realpathSync(f.preview));
    assert.equal(call.port, String(f.port));
    assert.equal(call.db, `postgresql://evermore:evermore@localhost:${f.port + 30}/evermore`);
  }
  assert.ok(f.calls().some(({ args }) => args.at(-1) === 'migrate'));
});

test('update prepares a stopped preview and bootstraps DB once the DB package lands', async (t) => {
  const f = await fixture(t, false);
  passed(f.run('update'));
  assert.equal(f.calls().filter(({ args }) => args[0] === 'dev').length, 0);
  assert.equal(f.state().dbReady, undefined);
  f.writePackage(true); f.publish();
  passed(f.run('update'));
  passed(f.run('update'));
  assert.equal(f.calls().filter(({ args }) => args[0] === 'db:setup').length, 1);
  assert.equal(f.state().dbReady, true);
});

test('failed setup is retryable and never marked ready or launches the dev server', async (t) => {
  const f = await fixture(t);
  const failed = f.run('start', { TEST_FAIL: 'db:setup' });
  assert.notEqual(failed.status, 0);
  assert.equal(f.calls().filter(({ args }) => args[0] === 'dev').length, 0);
  passed(f.run('update'));
  assert.equal(f.calls().filter(({ args }) => args[0] === 'db:setup').length, 2);
  assert.equal(f.state().dbReady, true);
  assert.notEqual(f.run('update', { TEST_FAIL: 'migrate' }).status, 0);
});

test('update refuses dirty worktrees, checked-out branches, and changed persisted ports', async (t) => {
  const f = await fixture(t);
  passed(f.run('update'));
  fs.writeFileSync(path.join(f.preview, 'page.txt'), 'local work');
  assert.match(f.run('update').stderr, /local changes/);
  assert.equal(fs.readFileSync(path.join(f.preview, 'page.txt'), 'utf8'), 'local work');
  git(f.preview, 'restore', 'page.txt');
  git(f.preview, 'checkout', '-b', 'human-work');
  assert.match(f.run('update').stderr, /detached HEAD/);
  git(f.preview, 'checkout', '--detach');
  assert.match(f.run('update', { PREVIEW_MAIN_PORT: String(f.port + 1) }).stderr, /already persisted/);
  fs.writeFileSync(path.join(f.preview, 'incoming.txt'), 'local untracked work');
  fs.writeFileSync(path.join(f.source, 'incoming.txt'), 'incoming main');
  f.publish();
  assert.notEqual(f.run('update').status, 0);
  assert.equal(fs.readFileSync(path.join(f.preview, 'incoming.txt'), 'utf8'), 'local untracked work');
});

test('invalid commands and ports fail before creating a worktree', async (t) => {
  const f = await fixture(t);
  assert.notEqual(f.run('unknown').status, 0);
  assert.notEqual(f.run('start', { PREVIEW_MAIN_PORT: 'invalid' }).status, 0);
  assert.equal(fs.existsSync(f.preview), false);
  passed(f.run('--help'));
});

test('a busy port prevents a second server from launching', async (t) => {
  const f = await fixture(t);
  const server = net.createServer();
  await new Promise((resolve) => server.listen(f.port, resolve));
  try {
    assert.notEqual(f.run('start').status, 0);
    assert.equal(f.calls().filter(({ args }) => args[0] === 'dev').length, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('default directory is beside the main checkout even when invoked from a linked worktree', async (t) => {
  const f = await fixture(t);
  const caller = path.join(f.source, '../caller');
  git(f.source, 'worktree', 'add', '--detach', caller);
  const result = spawnSync(process.execPath, [path.join(caller, 'scripts/preview-main.mjs'), 'update'], {
    env: { ...process.env, PATH: `${path.join(f.source, '../bin')}${path.delimiter}${process.env.PATH}`, PREVIEW_MAIN_PORT: String(f.port), TEST_CALLS: path.join(f.source, '../calls.jsonl'), PREVIEW_MAIN_DIR: undefined },
    encoding: 'utf8', timeout: 20000,
  });
  passed(result);
  const expected = path.join(f.source, '../evermore-preview');
  assert.equal(git(expected, 'branch', '--show-current'), '');
  assert.equal(git(expected, 'rev-parse', 'HEAD'), git(f.source, 'rev-parse', 'HEAD'));
  assert.equal(fs.existsSync(path.join(caller, '../evermore-preview')), true);
});

test('failed dev launch reports failure and a later start recovers', async (t) => {
  const f = await fixture(t);
  const failed = f.run('start', { TEST_FAIL: 'dev' });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /Dev server did not become ready/);
  passed(f.run('start'));
  assert.equal(await (await request(`http://localhost:${f.port}`)).text(), 'first main');
});


test('route additions, removals, and renames restart both detached servers; content edits hot reload', async (t) => {
  const f = await fixture(t);
  const env = { TEST_DETACHED: '1' };
  passed(f.run('start', env));
  let pid = f.state().pid;
  assert.equal((await request(`http://localhost:${f.port}/new`)).status, 404);
  for (const file of ['new/page.tsx', 'api/route.ts']) f.route(file);
  f.publish();
  passed(f.run('update', env));
  assert.notEqual(f.state().pid, pid);
  assert.equal((await request(`http://localhost:${f.port}/new`)).status, 200);
  assert.equal((await request(`http://localhost:${f.port}/api`)).status, 200);
  assert.equal((await request(`http://localhost:${f.port + 90}/new`)).status, 200);
  pid = f.state().pid;
  f.route('new/page.tsx', 'export default function Page() { return null; }'); f.publish();
  passed(f.run('update', env));
  assert.equal(f.state().pid, pid);
  fs.renameSync(path.join(f.source, 'apps/www/app/new'), path.join(f.source, 'apps/www/app/renamed'));
  f.publish();
  passed(f.run('update', env));
  assert.notEqual(f.state().pid, pid);
  assert.equal((await request(`http://localhost:${f.port}/new`)).status, 404);
  assert.equal((await request(`http://localhost:${f.port}/renamed`)).status, 200);
  pid = f.state().pid;
  fs.rmSync(path.join(f.source, 'apps/www/app/api'), {recursive:true}); f.publish();
  passed(f.run('update', env));
  assert.notEqual(f.state().pid, pid);
  assert.equal((await request(`http://localhost:${f.port}/api`)).status, 404);
  assert.equal(f.calls().filter(({args}) => args[0] === 'dev').length, 4);
});

test('stop works offline without setup, preserves data, and restart launches both servers again', async (t) => {
  const f = await fixture(t);
  passed(f.run('start', {TEST_DETACHED:'1', TEST_IGNORE_TERM:'1'}));
  const old = f.state();
  assert.ok(old.processes.length >= 3);
  git(f.source, 'remote', 'set-url', 'origin', path.join(f.source, 'unavailable'));
  fs.writeFileSync(path.join(f.preview, 'page.txt'), 'local changes');
  const before = f.calls().length;
  passed(f.run('stop', {TEST_FAIL:'catenv'}));
  assert.equal(f.calls().length, before);
  assert.equal(f.state().pid, undefined);
  assert.equal(f.state().dbReady, true);
  assert.equal(f.state().lock, old.lock);
  for (const port of [f.port, f.port+90]) await assert.rejects(request(`http://localhost:${port}`, {signal:AbortSignal.timeout(1000)}));
  passed(f.run('stop'));
  git(f.source, 'remote', 'set-url', 'origin', path.join(f.source, '../remote.git'));
  git(f.preview, 'restore', 'page.txt');
  passed(f.run('restart', {TEST_DETACHED:'1'}));
  assert.notEqual(f.state().pid, old.pid);
  const pid = f.state().pid;
  passed(f.run('restart', {TEST_DETACHED:'1'}));
  assert.notEqual(f.state().pid, pid);
  assert.equal((await request(`http://localhost:${f.port+90}`)).status, 200);
});

test('saved descendants can be stopped after the launcher exits', async (t) => {
  const f = await fixture(t);
  passed(f.run('start', {TEST_DETACHED:'1'}));
  process.kill(f.state().pid, 'SIGKILL');
  passed(f.run('stop'));
  for (const port of [f.port, f.port+90]) await assert.rejects(request(`http://localhost:${port}`, {signal:AbortSignal.timeout(1000)}));
});

test('a reused PID with a different start time is neither signalled nor treated as a running preview', async (t) => {
  const f = await fixture(t);
  passed(f.run('update'));
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio:'ignore'});
  await new Promise((resolve, reject) => { unrelated.once('spawn', resolve); unrelated.once('error', reject); });
  t.after(() => unrelated.kill('SIGKILL'));
  const stale = {...f.state(), pid:unrelated.pid, processes:[{pid:unrelated.pid, started:'a previous process'}]};
  f.writeState(stale);
  passed(f.run('stop'));
  assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
  f.writeState(stale);
  passed(f.run('start'));
  assert.notEqual(f.state().pid, unrelated.pid);
  assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
});

test('stop before the first preview is a no-op without contacting origin', async (t) => {
  const f = await fixture(t);
  git(f.source, 'remote', 'remove', 'origin');
  passed(f.run('stop'));
  assert.equal(fs.existsSync(f.preview), false);
  assert.deepEqual(f.calls(), []);
});
