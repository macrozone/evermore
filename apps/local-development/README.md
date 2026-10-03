# local-development

Local helper services via `docker compose` (file: [`docker-compose.yml`](docker-compose.yml)).

| Service      | Image                                       | Host port (env)   | Default | Container port |
| ------------ | ------------------------------------------- | ----------------- | ------- | -------------- |
| `db`         | `postgres:17`                               | `DB_PORT`         | `3030`  | `5432`         |
| `task-queue` | `ghcr.io/aertje/cloud-tasks-emulator` (gRPC) | `TASK_QUEUE_PORT` | `3031`  | `8123`         |

The defaults match the port slot of the main checkout (`BASE_PORT=3000`, DB `+30`, task queue `+31`). Worktrees set their own ports and their own `COMPOSE_PROJECT_NAME` (see evermore-ab1.2); without `COMPOSE_PROJECT_NAME` the project is named `evermore`.

## Commands

```bash
pnpm --filter @evermore/local-development services:up     # start both services in the background, waits until ready
pnpm --filter @evermore/local-development services:down   # stop, data is kept
pnpm --filter @evermore/local-development services:reset  # stop and delete data
```

`pnpm dev` also starts the services in the foreground (`docker compose up`).

## Access

- Postgres: `postgresql://evermore:evermore@localhost:${DB_PORT}/evermore`
- Cloud Tasks emulator: gRPC on `localhost:${TASK_QUEUE_PORT}`, queue `projects/evermore/locations/local/queues/default`. From inside the container, the emulator reaches apps on the host via `host.docker.internal`.

## Data

Postgres stores its data in the **named volume** `db-data`, created per Compose project (`<COMPOSE_PROJECT_NAME>_db-data`). It survives `services:down` and is only deleted by `services:reset` (`docker compose down -v`). The task emulator keeps its state in memory only.
