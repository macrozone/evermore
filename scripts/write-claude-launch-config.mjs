import fs from 'node:fs';
import { devUrls } from './dev-urls.mjs';

const { base } = devUrls();
const config = {
  version: '0.0.1',
  configurations: [{
    name: 'www',
    runtimeExecutable: 'pnpm',
    runtimeArgs: ['dev'],
    cwd: '.',
    port: base,
    autoPort: false,
    env: { BASE_PORT: String(base) },
  }],
};
fs.mkdirSync('.claude', { recursive: true });
fs.writeFileSync('.claude/launch.json', `${JSON.stringify(config, null, 2)}\n`);
console.log(`[claude-preview] www: http://localhost:${base} (.claude/launch.json)`);
