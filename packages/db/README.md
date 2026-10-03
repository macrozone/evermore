# @evermore/db

Prisma/PostgreSQL access for Evermore server apps and packages (ADR 0005).
The initial schema contains only an anonymous `Player` placeholder (`id`,
`createdAt`). No waitlist or personal information is stored.

## Local setup

From a fresh worktree after `pnpm install`, run:

```sh
pnpm db:setup
```

Requires Node 22.12+ and a running Docker daemon. The command generates local
environment files, starts this worktree's isolated Compose services with a
health check, generates and compiles the client, applies committed migrations,
and seeds a stable placeholder player. It also verifies the package export,
seed idempotence, and create/read/delete against the local database. Repeating
setup preserves existing data; it does not reset the database.

The database URL is `postgresql://evermore:evermore@localhost:<BASE_PORT + 30>/evermore`.
`db:setup` always uses that local URL, overriding any `DATABASE_URL` inherited
from the shell. Apps receive their local URL through catladder-generated env.

## Use in a server app or package

Add `"@evermore/db": "workspace:*"` to the consumer's dependencies. Its build
must run after the database package's build (the root Turbo `^build` dependency
handles this). Create a single client for the service and disconnect on shutdown:

```ts
import { createDb } from "@evermore/db";

const db = createDb(); // Reads DATABASE_URL; throws if missing.
const players = await db.player.findMany();
await db.$disconnect();
```

`createDb(url)` also accepts an explicit connection string. `Player`, `Prisma`,
and `PrismaClient` are exported for types and advanced queries. Keep this package
in server code; it is not a browser client.

## Schema changes and checks

With the worktree's local `DATABASE_URL` exported:

```sh
pnpm --filter @evermore/db migrate:dev --name describe_change
pnpm --filter @evermore/db build
pnpm --filter @evermore/db seed
pnpm --filter @evermore/db test:integration
```

Commit schema changes and their migrations together. `migrate` uses
`prisma migrate deploy` for noninteractive application of committed migrations.
`build` always runs `prisma generate`; generation needs no running database or
URL. Generated sources and compiled files are ignored by Git and restored by
Turbo's build cache. Root typecheck/lint tasks build this package before checking
it, including in a fresh worktree.
