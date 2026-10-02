# 0005 – Prisma als ORM

- Status: accepted
- Datum: 2026-10-02
- Entscheider: maw
- Bead: evermore-ab1.3

## Kontext und Problem

`packages/db` braucht ein ORM für Postgres, lokal via docker compose, in Produktion später CloudSQL über catladder.

## Betrachtete Optionen

- Prisma
- Drizzle

## Entscheidung

Gewählt: **Prisma**. Das Team kennt es aus food-2050, und catladder erzeugt den CloudSQL-Connection-String standardmässig im Prisma-Format (`dbConnectionStringFormat: "prisma"`).

## Konsequenzen

- Positiv: bekannte Werkzeuge (migrate, seed), passt zu catladder.
- Negativ: Codegen-Schritt (`prisma generate`) in Build und frischen Worktrees nötig; schwererer Client als Drizzle.
