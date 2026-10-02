# local-development

Lokale Hilfsdienste per `docker compose` (Datei: [`docker-compose.yml`](docker-compose.yml)).

| Dienst       | Image                                       | Host-Port (Env)   | Default | Container-Port |
| ------------ | ------------------------------------------- | ----------------- | ------- | -------------- |
| `db`         | `postgres:17`                               | `DB_PORT`         | `3030`  | `5432`         |
| `task-queue` | `ghcr.io/aertje/cloud-tasks-emulator` (gRPC) | `TASK_QUEUE_PORT` | `3031`  | `8123`         |

Die Defaults entsprechen dem Port-Slot des Hauptcheckouts (`BASE_PORT=3000`, DB `+30`, Task-Queue `+31`). Worktrees setzen eigene Ports und einen eigenen `COMPOSE_PROJECT_NAME` (siehe evermore-ab1.2); ohne `COMPOSE_PROJECT_NAME` heisst das Projekt `evermore`.

## Befehle

```bash
pnpm --filter @evermore/local-development services:up     # beide Dienste im Hintergrund starten, wartet bis bereit
pnpm --filter @evermore/local-development services:down   # stoppen, Daten bleiben
pnpm --filter @evermore/local-development services:reset  # stoppen und Daten löschen
```

`pnpm dev` startet die Dienste im Vordergrund mit (`docker compose up`).

## Zugang

- Postgres: `postgresql://evermore:evermore@localhost:${DB_PORT}/evermore`
- Cloud-Tasks-Emulator: gRPC auf `localhost:${TASK_QUEUE_PORT}`, Queue `projects/evermore/locations/local/queues/default`. Aus dem Container erreicht der Emulator Apps auf dem Host über `host.docker.internal`.

## Daten

Postgres speichert in das **benannte Volume** `db-data`, das pro Compose-Projekt angelegt wird (`<COMPOSE_PROJECT_NAME>_db-data`). Es übersteht `services:down` und wird erst mit `services:reset` (`docker compose down -v`) gelöscht. Der Task-Emulator hält seinen Zustand nur im Speicher.
