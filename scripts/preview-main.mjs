import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../', import.meta.url));
const command = process.argv[2];
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const alive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    // An orphaned zombie still accepts signal 0 but cannot serve HTTP.
    const status = execFileSync('ps', ['-p', String(pid), '-o', 'stat='], { encoding: 'utf8', timeout: 3000 }).trim();
    return status !== '' && !status.startsWith('Z');
  } catch (error) {
    if (error.code === 'ESRCH' || error.status === 1) return false;
    throw error;
  }
};

async function preview() {
  if (command === '--help') {
    console.log('Usage: pnpm preview:main <start|update>\nPREVIEW_MAIN_DIR: worktree path (default: ../evermore-preview beside the main checkout)\nPREVIEW_MAIN_PORT: fixed BASE_PORT (default: 3900)\nstart runs pnpm dev in the background; update keeps it running.');
    return;
  }
  if (!['start', 'update'].includes(command) || process.argv.length !== 3) throw new Error('Use pnpm preview:main <start|update> (or --help).');
  const port = process.env.PREVIEW_MAIN_PORT ?? '3900';
  if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65436) throw new Error('PREVIEW_MAIN_PORT must be an integer between 1024 and 65436.');
  const common = fs.realpathSync(git(source, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
  const worktree = path.resolve(source, process.env.PREVIEW_MAIN_DIR ?? path.join(common, '../../evermore-preview'));
  const env = { ...process.env, PREVIEW_MAIN: '1', BASE_PORT: String(Number(port)), DATABASE_URL: `postgresql://evermore:evermore@localhost:${Number(port) + 30}/evermore` };
  const run = (args) => execFileSync('pnpm', args, { cwd: worktree, env, stdio: 'inherit' });

  git(source, ['fetch', 'origin', 'main']);
  if (!fs.existsSync(worktree)) git(source, ['worktree', 'add', '--detach', worktree, 'origin/main']);
  if (fs.realpathSync(git(worktree, ['rev-parse', '--show-toplevel'])) !== fs.realpathSync(worktree)
      || fs.realpathSync(git(worktree, ['rev-parse', '--path-format=absolute', '--git-common-dir'])) !== common) {
    throw new Error('Preview path must be a worktree of this repository.');
  }
  if (git(worktree, ['branch', '--show-current'])) throw new Error('Preview worktree must have a detached HEAD; refusing to change a checked-out branch.');
  if (git(worktree, ['status', '--porcelain', '--untracked-files=no'])) throw new Error('Preview worktree has local changes; refusing to overwrite them.');
  const gitDir = git(worktree, ['rev-parse', '--absolute-git-dir']);
  const stateFile = path.join(gitDir, 'preview-main.json');
  const logFile = path.join(gitDir, 'preview-main.log');
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
  if (state.port !== undefined && state.port !== env.BASE_PORT) throw new Error('Preview port is already persisted. Keep PREVIEW_MAIN_PORT unchanged for this worktree.');
  const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');

  git(worktree, ['checkout', '--detach', 'origin/main']);
  const lock = createHash('sha256').update(fs.readFileSync(path.join(worktree, 'pnpm-lock.yaml'))).digest('hex');
  if (state.lock !== lock || !fs.existsSync(path.join(worktree, 'node_modules'))) {
    run(['install', '--frozen-lockfile']);
    state.lock = lock;
  }
  run(['catenv']);
  const pkg = JSON.parse(fs.readFileSync(path.join(worktree, 'package.json'), 'utf8'));
  if (pkg.scripts?.['db:setup'] && !state.dbReady) {
    run(['db:setup']);
    state.dbReady = true;
  } else {
    run(['--filter', '@evermore/local-development', 'services:up']);
    if (pkg.scripts?.['db:setup']) {
      run(['--filter', '@evermore/db', 'build']);
      run(['--filter', '@evermore/db', 'migrate']);
    } else {
      console.log('[preview:main] No db:setup on main yet; local services are ready.');
    }
  }
  state.port = env.BASE_PORT;
  save();
  const url = `http://localhost:${env.BASE_PORT}`;
  console.log(`[preview:main] ${git(worktree, ['rev-parse', '--short', 'HEAD'])} in ${worktree}\n[preview:main] ${url} (dev index: http://localhost:${Number(port) + 90})\n[preview:main] Log: ${logFile}`);
  if (command === 'update') {
    console.log(`[preview:main] ${alive(state.pid) ? `Dev server remains running (PID ${state.pid}).` : 'Updated. Run start to launch the dev server.'}`);
    return;
  }
  if (!alive(state.pid)) {
    // Refuse a busy web port before starting Next, which might otherwise switch ports.
    await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', reject);
      server.listen(Number(port), () => server.close(resolve));
    });
    const log = fs.openSync(logFile, 'a');
    const child = spawn('pnpm', ['dev'], { cwd: worktree, env, detached: true, stdio: ['ignore', log, log] });
    fs.closeSync(log);
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    state.pid = child.pid;
    save();
    child.unref();
  }
  // Wait for HTTP readiness so a failed launch is visible to the caller.
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && alive(state.pid)) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      await response.body?.cancel();
      if (response.ok) {
        console.log(`[preview:main] Ready (PID ${state.pid}).`);
        return;
      }
    } catch { /* The server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Dev server did not become ready within 60 seconds. Inspect ${logFile}; rerun start after fixing the error.`);
}

preview().catch((error) => {
  console.error(`[preview:main] ${error.message}`);
  process.exitCode = 1;
});
