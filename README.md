# evermore

Online-Action-Rollenspiel im 16-Bit-Look mit starkem User Generated Content. Turborepo-Monorepo mit pnpm (`apps/*`, `packages/*`, Paket-Scope `@evermore/*`).

## Setup

1. Node 22 aktivieren: `nvm use` (liest `.nvmrc`)
2. pnpm in der Version aus `packageManager` aktivieren: `corepack enable`
3. Abhängigkeiten installieren: `pnpm install`
4. Lokale Dienste (Postgres, Cloud-Tasks-Emulator) starten: `pnpm --filter @evermore/local-development services:up` (Docker nötig, siehe [`apps/local-development`](apps/local-development/README.md))
5. Entwickeln: `pnpm dev`
6. Prüfen: `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`

Entscheidungen stehen in [`docs/adr/`](docs/adr/README.md), Aufgaben in Beads (`bd ready`).
