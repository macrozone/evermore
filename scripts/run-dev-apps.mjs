import { spawn } from 'node:child_process';

// Explicitly inherit the loaded env file; node --run does not forward it.
const child = spawn('pnpm', ['dev:apps'], { stdio: 'inherit', env: process.env });
child.on('error', (error) => {
  console.error(`[dev] ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => child.kill(signal));
}
