# evermore

Online action role-playing game with a 16-bit look and strong user-generated content. Turborepo monorepo with pnpm (`apps/*`, `packages/*`, package scope `@evermore/*`).

## Setup

1. Activate Node 22: `nvm use` (reads `.nvmrc`)
2. Activate the pnpm version from `packageManager`: `corepack enable`
3. Install dependencies: `pnpm install`
4. Set up local services and database: `pnpm db:setup` (requires Docker; starts Postgres and the Cloud Tasks emulator, applies migrations and seeds the worktree database). Repeat safely whenever migrations change. See [`packages/db`](packages/db/README.md).
5. Develop: `pnpm dev` – the web app [`apps/www`](apps/www) runs on `http://localhost:${BASE_PORT:-3000}`
6. Check: `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`

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
