# 0004 – CI/CD mit catladder, GitHub Actions und Cloud Run

- Status: accepted
- Datum: 2026-10-02
- Entscheider: maw
- Bead: evermore-7wc.5, evermore-b4t

## Kontext und Problem

Code liegt auf GitHub. Bei Panter wird CI/CD mit catladder generiert; Review-Instanzen pro PR sind gewünscht, um Agent-Arbeit schnell testen zu können.

## Betrachtete Optionen

- catladder (generiert GitHub Actions), Deploy auf Google Cloud Run
- Handgeschriebene GitHub Actions
- Vercel o.ä.

## Entscheidung

Gewählt: **catladder** mit `pipelines: { github: true }`, `customerName: pan`, `appName: evermore`, Deploy-Typ `google-cloudrun` im GCP-Projekt `maw-evermore`, Region `europe-west6`. Environments: review (pro PR), dev (main), stage/prod (Releases).

## Konsequenzen

- Positiv: einheitlich mit anderen Panter-Projekten, Review-Apps pro PR.
- Generierte Dateien (`.github/workflows/`, `.catladder-generated/`) werden nie von Hand geändert – nur `catladder.ts` + `pnpm catenv`.
- Cloud-Ressourcen provisioniert ein Mensch (`pnpm catladder project setup`, braucht GCP-Login); Agents erhalten keinen GCP-Zugang. Bis dahin schlagen Deploy-Jobs fehl – sie zählen nicht zu den Pflicht-Checks (siehe ADR 0006).
