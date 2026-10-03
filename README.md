# evermore

Online action role-playing game with a 16-bit look and strong user-generated content. Turborepo monorepo with pnpm (`apps/*`, `packages/*`, package scope `@evermore/*`).

## Setup

1. Activate Node 22: `nvm use` (reads `.nvmrc`)
2. Activate the pnpm version from `packageManager`: `corepack enable`
3. Install dependencies: `pnpm install`
4. Develop: `pnpm dev` (requires Docker) – generates the worktree environment, starts Postgres, the Cloud Tasks emulator, the web app, and the dev index. It prints all local addresses before starting the servers.
5. Check: `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`

The main checkout uses `BASE_PORT=3000`; linked worktrees receive a stable
100-port slot. The web app uses `BASE_PORT`, Postgres `+30`, Cloud Tasks `+31`,
and the dev index `+90` (for example, <http://localhost:3090> in the main
checkout). The index links to www, the lab, and moodboards. Ctrl-C stops the
foreground processes; Compose data is kept. See
[`apps/local-development`](apps/local-development/README.md) for service commands.

`pnpm catenv` also generates the gitignored `.claude/launch.json` for the
current slot. In Claude Code Desktop, open this checkout or worktree as the
project and start the **www** Preview configuration. It runs `pnpm dev` from
the root and previews the web app on the assigned port. Automatic port
switching is disabled so the app, Preview, and services keep the same slot.
After changing `BASE_PORT`, run `pnpm catenv` again to refresh Preview.
The format follows [Claude's preview server configuration](https://code.claude.com/docs/en/desktop#configure-preview-servers).

Decisions are in [`docs/adr/`](docs/adr/README.md), tasks in Beads (`bd ready`).

## Headless lab screenshots

Install Chromium once after `pnpm install`: `pnpm exec playwright install chromium`.
On Linux, use `pnpm exec playwright install --with-deps chromium` if system
libraries are missing. No desktop session or browser bridge is required.

From the repository root:

```sh
pnpm screenshot /lab
pnpm screenshot /lab/world --wait 3000 --out /tmp/evermore-world.png
```

The script uses the worktree's stable `BASE_PORT` from `ensure-base-port`,
reuses an HTTP server already listening there, or starts only `apps/www` and
stops that server after capture (including failures). Keep reused servers on
the same worktree and port. It captures a full-page PNG at a 1440 × 1000
viewport after page load, font loading, and a configurable delay (default
1000 ms, maximum 120000 ms). The default output is a timestamped file under
`docs/lab/screenshots/`; `--out` accepts an absolute path or a path relative
to the repository root. HTTP errors fail instead of producing an error-page
screenshot. `pnpm screenshot --help` shows the command syntax.

For the R2 movement regression check, start this worktree's web server and run
`node scripts/check-r2-movement.mjs http://127.0.0.1:<BASE_PORT>`. The headless
check holds diagonal keys, verifies wall sliding and live settings without a
renderer reset, and checks desktop/mobile overlay placement after scrolling.
Interaction screenshots are saved under `/tmp/evermore-r2-check/`.
