import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const script = fileURLToPath(new URL('./prune-orphan-dev-stacks.mjs', import.meta.url));
const root = fileURLToPath(new URL('../', import.meta.url));
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evermore-prune-'));
  const main = path.join(dir, 'main');
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(main);
  fs.mkdirSync(bin);
  const git = (...args) => execFileSync('git', args, { cwd: main, stdio: 'pipe' });
  git('init');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'fixture');
  const log = path.join(dir, 'docker.jsonl');
  fs.writeFileSync(path.join(bin, 'docker'), `#!${process.execPath}\n` + `
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.DOCKER_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'ps') {
  if (process.env.DOCKER_FAIL) process.exit(1);
  console.log(process.env.DOCKER_PROJECTS);
}
if (args[0] === 'compose' && process.env.DOCKER_DOWN_FAIL) process.exit(1);
`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, DOCKER_LOG: log,
    DOCKER_PROJECTS: 'evermore-3000\nevermore-5100\nevermore-5200\nevermore-5300\nevermore-12000\nevermore\nfood-5400\nevermore-invalid\nevermore-5200' };
  delete env.BASE_PORT;
  delete env.DOCKER_FAIL;
  delete env.DOCKER_DOWN_FAIL;
  const run = (args = [], extra = {}) => spawnSync(process.execPath, [script, ...args], {
    cwd: main, env: { ...env, ...extra }, encoding: 'utf8',
  });
  const calls = () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) : [];
  return { dir, main, bin, env, git, run, calls, log, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('dry-run and deletion protect live worktrees and only remove orphan generated stacks', () => {
  const f = fixture();
  try {
    const live = path.join(f.dir, 'live "worktree"\nwith newline');
    const gone = path.join(f.dir, 'deleted');
    const fallback = path.join(f.dir, 'fallback');
    f.git('worktree', 'add', '--detach', live);
    f.git('worktree', 'add', '--detach', gone);
    f.git('worktree', 'add', '--detach', fallback);
    fs.writeFileSync(path.join(live, '.env.local'), 'BASE_PORT=5100\n');
    fs.writeFileSync(path.join(live, '.env'), 'BASE_PORT=5200\n');
    fs.writeFileSync(path.join(fallback, '.env'), 'BASE_PORT=12000\n');
    fs.writeFileSync(path.join(gone, '.env.local'), 'BASE_PORT=5300\n');
    fs.rmSync(gone, { recursive: true, force: true });
    const dry = f.run(['--dry-run']);
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /Would remove evermore-5200/);
    assert.match(dry.stdout, /Would remove evermore-5300/);
    assert.doesNotMatch(dry.stdout, /evermore-(3000|5100|12000)|food|invalid/);
    assert.equal(f.calls().length, 1);
    fs.unlinkSync(f.log);
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const downs = f.calls().filter((args) => args[0] === 'compose');
    assert.deepEqual(downs, ['5200', '5300'].map((port) => ['compose', '-f',
      path.join(root, 'apps/local-development/docker-compose.yml'), '-p', `evermore-${port}`, 'down', '--remove-orphans']));
    // Explicit overrides are protected in addition to persisted assignments.
    fs.unlinkSync(f.log);
    assert.equal(f.run([], { BASE_PORT: '5200' }).status, 0);
    assert.equal(f.calls().filter((args) => args[0] === 'compose').length, 1);
  } finally { f.cleanup(); }
});

test('invalid environment, failed discovery and Docker failure never issue removals', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.main, '.env.local'), 'BASE_PORT=NaN\n');
    const invalid = f.run();
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Invalid BASE_PORT/);
    assert.deepEqual(f.calls(), []);
    fs.unlinkSync(path.join(f.main, '.env.local'));
    assert.notEqual(f.run([], { DOCKER_FAIL: '1' }).status, 0);
    assert.ok(f.calls().every((args) => args[0] === 'ps'));
    fs.unlinkSync(f.log);
    fs.renameSync(path.join(f.main, '.git'), path.join(f.main, 'hidden-git'));
    assert.notEqual(f.run().status, 0);
    assert.deepEqual(f.calls(), []);
  } finally { f.cleanup(); }
});

test('help and invalid arguments do not contact Docker', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['--help']).status, 0);
    assert.notEqual(f.run(['--volumes']).status, 0);
    assert.deepEqual(f.calls(), []);
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.ok(pkg.scripts.dev.indexOf('prune-orphan-dev-stacks.mjs') < pkg.scripts.dev.indexOf('run-dev-apps.mjs'));
  } finally { f.cleanup(); }
});


test('discovery validates all project ports before deletion and propagates teardown failure', () => {
  const f = fixture();
  try {
    const invalid = f.run([], { DOCKER_PROJECTS: 'evermore-5100\nevermore-99999' });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Invalid BASE_PORT/);
    assert.ok(f.calls().every((args) => args[0] === 'ps'));
    fs.unlinkSync(f.log);
    const failure = f.run([], { DOCKER_DOWN_FAIL: '1' });
    assert.notEqual(failure.status, 0);
    assert.equal(f.calls().filter((args) => args[0] === 'compose').length, 1);
    fs.unlinkSync(f.log);
    fs.writeFileSync(path.join(f.bin, 'git'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const empty = f.run();
    assert.notEqual(empty.status, 0);
    assert.match(empty.stderr, /No Git worktrees/);
    assert.deepEqual(f.calls(), []);
  } finally { f.cleanup(); }
});

test('dev startup removes the deleted worktree stack first and stops if cleanup fails', () => {
  const f = fixture();
  try {
    const gone = path.join(f.dir, 'deleted');
    f.git('worktree', 'add', '--detach', gone);
    fs.writeFileSync(path.join(gone, '.env.local'), 'BASE_PORT=5100\n');
    f.git('worktree', 'remove', '--force', gone);
    fs.mkdirSync(path.join(f.main, 'scripts'));
    fs.copyFileSync(script, path.join(f.main, 'scripts/prune-orphan-dev-stacks.mjs'));
    fs.writeFileSync(path.join(f.main, 'scripts/run-dev-apps.mjs'), `
import fs from 'node:fs';
const calls = fs.readFileSync(process.env.DOCKER_LOG, 'utf8').trim().split('\\n').map(JSON.parse);
if (!calls.some((args) => args[0] === 'compose' && args.includes('evermore-5100'))) process.exit(1);
console.log('DEV_APPS_STARTED');
`);
    fs.writeFileSync(path.join(f.bin, 'pnpm'), '#!/bin/sh\n[ "$1" = catenv ] || exit 1\nprintf "BASE_PORT=3000\\n" > .env.local\n', { mode: 0o755 });
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const start = (extra = {}) => spawnSync('/bin/sh', ['-c', pkg.scripts.dev], {
      cwd: f.main, env: { ...f.env, ...extra }, encoding: 'utf8',
    });
    const result = start();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /DEV_APPS_STARTED/);
    const failure = start({ DOCKER_FAIL: '1' });
    assert.notEqual(failure.status, 0);
    assert.doesNotMatch(failure.stdout, /DEV_APPS_STARTED/);
  } finally { f.cleanup(); }
});
