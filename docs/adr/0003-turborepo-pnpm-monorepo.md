# 0003 – Monorepo mit Turborepo und pnpm

- Status: accepted
- Datum: 2026-10-02
- Entscheider: maw
- Bead: evermore-7wc

## Kontext und Problem

Evermore startet mit einer Next.js-App, wird aber Background-Services und geteilte Business-Logik bekommen. Das Setup soll dem bewährten food-2050 ähneln, damit Wissen und Scripts übertragbar sind.

## Betrachtete Optionen

- Turborepo + pnpm-Workspaces (wie food-2050)
- Einzelne Next.js-App, später aufteilen
- Nx

## Entscheidung

Gewählt: **Turborepo + pnpm**, Node 22, Struktur `apps/*` und `packages/*`, Paket-Scope `@evermore/*`.

## Konsequenzen

- Positiv: geteilte Logik in `packages/`, gecachte Builds, bekanntes Setup.
- Negativ: mehr Grundgerüst als eine Einzel-App.
- Lokales Dev-Setup worktree-fähig (eigener Port-Slot und Docker-Stack pro Worktree), angelehnt an food-2050, aber bewusst schlanker (siehe evermore-ab1).
