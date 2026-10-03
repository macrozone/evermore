import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const compose = path.join(root, 'apps/local-development/docker-compose.yml');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: pnpm services:prune [--dry-run]\nRemove orphan evermore-<BASE_PORT> containers and networks; keep database volumes.');
} else if (args.some((arg) => arg !== '--dry-run')) {
  console.error('[services:prune] Unknown option. Use --help for usage.');
  process.exitCode = 1;
} else {
  try {
    const run = (command, argv, timeout = 10000) => execFileSync(command, argv, {
      cwd: process.cwd(), encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const validPort = (value) => {
      if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65436) {
        throw new Error(`Invalid BASE_PORT ${JSON.stringify(value)}; refusing to prune.`);
      }
      return String(Number(value));
    };
    const readEnv = (dir, name) => {
      const file = path.join(dir, name);
      return fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
    };
    // NUL-delimited paths also cover spaces, quotes and newlines. Missing
    // directories may still be registered until git worktree prune runs.
    const worktrees = run('git', ['worktree', 'list', '--porcelain', '-z'])
      .split('\0').filter((field) => field.startsWith('worktree ')).map((field) => field.slice(9));
    if (worktrees.length === 0) throw new Error('No Git worktrees found; refusing to prune.');
    const livePorts = new Set();
    for (const dir of worktrees) {
      if (!fs.existsSync(dir)) continue;
      const value = readEnv(dir, '.env.local').BASE_PORT ?? readEnv(dir, '.env').BASE_PORT;
      // The main checkout defaults to 3000 before its first environment build.
      if (value !== undefined) livePorts.add(validPort(value));
      else if (fs.statSync(path.join(dir, '.git')).isDirectory()) livePorts.add('3000');
    }
    if (process.env.BASE_PORT !== undefined) livePorts.add(validPort(process.env.BASE_PORT));
    // Include stopped containers; restrict cleanup to the generated project
    // naming scheme, leaving legacy "evermore" and other applications alone.
    const projects = new Set(run('docker', ['ps', '-a', '--filter', 'label=com.docker.compose.project',
      '--format', '{{.Label "com.docker.compose.project"}}']).trim().split('\n'));
    // Validate every candidate before performing the first removal.
    const orphans = [...projects].sort().filter((project) => {
      const match = /^evermore-([1-9]\d*)$/.exec(project);
      return match && !livePorts.has(validPort(match[1]));
    });
    for (const project of orphans) {
      console.log(`[services:prune] ${args.includes('--dry-run') ? 'Would remove' : 'Removing'} ${project} (keeping volumes)`);
      if (!args.includes('--dry-run')) {
        // Use this checkout's Compose file: the orphan's file no longer exists.
        const output = run('docker', ['compose', '-f', compose, '-p', project, 'down', '--remove-orphans'], 60000);
        if (output.trim()) console.log(output.trim());
      }
    }
  } catch (error) {
    console.error(`[services:prune] ${error.message}`);
    process.exitCode = 1;
  }
}
