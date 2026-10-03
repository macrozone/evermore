# evermore

Online action role-playing game with a 16-bit look and strong user-generated content. Turborepo monorepo with pnpm (`apps/*`, `packages/*`, package scope `@evermore/*`).

## Setup

1. Activate Node 22: `nvm use` (reads `.nvmrc`)
2. Activate the pnpm version from `packageManager`: `corepack enable`
3. Install dependencies: `pnpm install`
4. Start local services (Postgres, Cloud Tasks emulator): `pnpm --filter @evermore/local-development services:up` (requires Docker, see [`apps/local-development`](apps/local-development/README.md))
5. Develop: `pnpm dev` – the web app [`apps/www`](apps/www) runs on `http://localhost:${BASE_PORT:-3000}`
6. Check: `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`

Decisions are in [`docs/adr/`](docs/adr/README.md), tasks in Beads (`bd ready`).
