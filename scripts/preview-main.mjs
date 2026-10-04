import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../', import.meta.url));
const command = process.argv[2];
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
// Turbo/Next can put descendants in separate process groups. Capture the tree
// before signalling its root, and retain identities if a parent exits early.
const processes = () => execFileSync('ps', ['-axo', 'pid=,ppid=,stat=,lstart='], { encoding: 'utf8', timeout: 3000 })
  .trim().split('\n').map((line) => {
    const [, pid, parent, status, started] = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/) ?? [];
    return { pid: Number(pid), parent: Number(parent), status, started };
  }).filter(({ pid, status }) => pid > 0 && !status.startsWith('Z'));
const ownedProcesses = (state, table = processes()) => {
  const owned = new Set(table.filter((entry) => state.processes?.some(({ pid, started }) => pid === entry.pid && started === entry.started)).map(({ pid }) => pid));
  // Older state files only recorded the launcher PID.
  if (!state.processes && table.some(({ pid }) => pid === state.pid)) owned.add(state.pid);
  let size;
  do {
    size = owned.size;
    for (const { pid, parent } of table) if (owned.has(parent)) owned.add(pid);
  } while (size !== owned.size);
  return table.filter(({ pid }) => owned.has(pid));
};
const identities = (entries) => entries.map(({ pid, started }) => ({ pid, started }));
const running = (state) => ownedProcesses(state).length > 0;
async function stop(state, save) {
  const entries = ownedProcesses(state);
  state.processes = identities(entries);
  save();
  const remaining = () => processes().filter((entry) => entries.some(({ pid, started }) => pid === entry.pid && started === entry.started));
  const signal = (entries, name) => {
    for (const { pid } of entries.reverse()) {
      try { process.kill(pid, name); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  };
  signal([...entries], 'SIGTERM');
  let deadline = Date.now() + 5000;
  while (remaining().length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  signal(remaining(), 'SIGKILL');
  deadline = Date.now() + 3000;
  while (remaining().length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  if (remaining().length) throw new Error('Could not stop all preview processes; inspect the saved process identities.');
  delete state.pid;
  delete state.processes;
  delete state.routes;
  save();
}
const routes = (cwd, revision) => git(cwd, ['ls-tree', '-r', '--name-only', revision, '--', 'apps/www/app', 'apps/www/src/app'])
  .split('\n').filter((file) => /\/(page|route)\.(tsx?|jsx?)$/.test(file)).sort().join('\n');

async function preview() {
  if (command === '--help') {
    console.log('Usage: pnpm preview:main <start|update|stop|restart>\nPREVIEW_MAIN_DIR: worktree path (default: ../evermore-preview beside the main checkout)\nPREVIEW_MAIN_PORT: fixed BASE_PORT (default: 3900)\nupdate restarts a running preview when App routes change; stop keeps Compose data.');
    return;
  }
  if (!['start', 'update', 'stop', 'restart'].includes(command) || process.argv.length !== 3) throw new Error('Use pnpm preview:main <start|update|stop|restart> (or --help).');
  const port = process.env.PREVIEW_MAIN_PORT ?? '3900';
  if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65436) throw new Error('PREVIEW_MAIN_PORT must be an integer between 1024 and 65436.');
  const common = fs.realpathSync(git(source, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
  const worktree = path.resolve(source, process.env.PREVIEW_MAIN_DIR ?? path.join(common, '../../evermore-preview'));
  const env = { ...process.env, PREVIEW_MAIN: '1', BASE_PORT: String(Number(port)), DATABASE_URL: `postgresql://evermore:evermore@localhost:${Number(port) + 30}/evermore` };
  const run = (args) => execFileSync('pnpm', args, { cwd: worktree, env, stdio: 'inherit' });

  if (command === 'stop' && !fs.existsSync(worktree)) {
    console.log('[preview:main] Already stopped (no preview worktree).');
    return;
  }
  if (command !== 'stop') git(source, ['fetch', 'origin', 'main']);
  if (!fs.existsSync(worktree)) git(source, ['worktree', 'add', '--detach', worktree, 'origin/main']);
  if (fs.realpathSync(git(worktree, ['rev-parse', '--show-toplevel'])) !== fs.realpathSync(worktree)
      || fs.realpathSync(git(worktree, ['rev-parse', '--path-format=absolute', '--git-common-dir'])) !== common) {
    throw new Error('Preview path must be a worktree of this repository.');
  }
  const gitDir = git(worktree, ['rev-parse', '--absolute-git-dir']);
  const stateFile = path.join(gitDir, 'preview-main.json');
  const logFile = path.join(gitDir, 'preview-main.log');
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
  const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
  if (command === 'stop') {
    await stop(state, save);
    console.log('[preview:main] Stopped www and dev index. Compose data is kept.');
    return;
  }
  if (git(worktree, ['branch', '--show-current'])) throw new Error('Preview worktree must have a detached HEAD; refusing to change a checked-out branch.');
  if (git(worktree, ['status', '--porcelain', '--untracked-files=no'])) throw new Error('Preview worktree has local changes; refusing to overwrite them.');
  if (state.port !== undefined && state.port !== env.BASE_PORT) throw new Error('Preview port is already persisted. Keep PREVIEW_MAIN_PORT unchanged for this worktree.');
  const targetRoutes = routes(worktree, 'origin/main');
  const routeChange = (state.routes ?? routes(worktree, 'HEAD')) !== targetRoutes;
  const restartRunning = routeChange && running(state);
  if (command === 'restart' || restartRunning) {
    console.log(`[preview:main] Restarting${routeChange ? ' for changed App routes' : ''}.`);
    await stop(state, save);
  }

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
  if (command === 'update' && !restartRunning) {
    if (running(state)) { state.processes = identities(ownedProcesses(state)); save(); }
    console.log(`[preview:main] ${running(state) ? `Dev server remains running (PID ${state.pid}).` : 'Updated. Run start to launch the dev server.'}`);
    return;
  }
  if (!running(state)) {
    await stop(state, save);
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
    state.routes = targetRoutes;
    state.processes = identities(processes().filter(({ pid }) => pid === child.pid));
    save();
    child.unref();
  }
  // Wait for HTTP readiness so a failed launch is visible to the caller.
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && running(state)) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      await response.body?.cancel();
      if (response.ok) {
        state.processes = identities(ownedProcesses(state));
        save();
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
