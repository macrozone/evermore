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

## Persistent main preview

```sh
pnpm preview:main start
pnpm preview:main update
```

`start` fetches `origin/main`, creates a detached worktree at
`../evermore-preview` beside the main checkout, installs dependencies, prepares
local services, and launches `pnpm dev` in the background. It waits for the web
app at <http://localhost:3900>; the dev index is at <http://localhost:3990>.
Repeated starts reuse the same server. The main checkout stays on its branch.

`update` fetches and checks out the latest `origin/main` in that worktree.
It installs dependencies only when the lockfile changed or `node_modules` is
missing, regenerates the environment, and applies database migrations. The
running dev server keeps its PID and picks up app changes through hot reload.
The preview uses Webpack with a one-second filesystem poll for reliable updates
after Git checkouts; ordinary `pnpm dev` keeps the default Turbopack watcher.
An update can also prepare a stopped preview; use `start` to launch it.
Changes to dev tooling or server startup configuration may require a restart.

Once `db:setup` is available on main, the first preparation runs it (including
seed); later updates build the DB client and run migrations against the
preview's own database on port 3930. Before the DB package lands, preparation
starts only the existing Compose services. Docker must be running.

Set `PREVIEW_MAIN_DIR` to override the path (relative paths are resolved from
the invoking checkout), or `PREVIEW_MAIN_PORT` to override the fixed port on
first use. Both commands must use the same settings; ordinary `BASE_PORT` from
another worktree is ignored. For example:

```sh
PREVIEW_MAIN_DIR=/path/to/preview PREVIEW_MAIN_PORT=3900 pnpm preview:main start
PREVIEW_MAIN_DIR=/path/to/preview PREVIEW_MAIN_PORT=3900 pnpm preview:main update
```

The script refuses changes to tracked files, worktrees from other repositories, and
worktrees with a checked-out branch. Keep the preview worktree dedicated to
this command. Git also refuses updates that would overwrite untracked files;
untracked generated Catladder skills do not block updates. Logs and setup/PID state live in its Git metadata directory;
the log path and PID are printed at startup. To stop the background process
group, run `kill -INT -- -<PID>` with that PID. Compose data is kept; run
`pnpm --filter @evermore/local-development services:down` from the preview
worktree to stop the containers too. A subsequent `start` relaunches the server.

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

To check the R1 fullscreen pixel pass against zoom/frustum-culling regressions,
start `apps/www` in this worktree, then run:

```sh
pnpm test:r1-zoom http://127.0.0.1:<BASE_PORT> /tmp/evermore-r1-zoom
```

The headless Chromium check reads pixels immediately after the actual screen
draw, checks every camera preset at zoom 0.5–3 (including 1.75), and verifies
page/panel scrolling and mobile resize. It rejects a missing screen draw, a
transparent canvas, a sky-only result, or browser/WebGL errors, and writes PNGs
for visual review. It runs separately from unit tests and needs a local server.
