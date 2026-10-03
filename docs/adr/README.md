# Architecture Decision Records (ADR)

Projektweite Entscheidungen (Architektur, Technologie, Prozess, Produkt-Scope) werden hier als ADR festgehalten – Format: [MADR](https://adr.github.io/madr/), Vorlage: [template.md](template.md).

## Regeln

- Eine Datei pro Entscheidung: `NNNN-kurzer-titel.md`, fortlaufend nummeriert.
- Status: `proposed` → `accepted` | `rejected`; später ggf. `superseded by NNNN`.
- Angenommene ADRs werden inhaltlich **nicht** mehr geändert. Eine Änderung der Entscheidung = neue ADR, die alte bekommt `superseded by NNNN`.
- Offene Entscheidungen werden zuerst als Bead (`-t decision`, Label `human`) erfasst und blockieren die betroffenen Tasks. Ist entschieden, entsteht die ADR, das Bead verweist darauf und wird geschlossen.
- Neue ADRs in die Liste unten eintragen.

## Index

| Nr. | Titel | Status |
|---|---|---|
| [0001](0001-entscheidungen-als-adr-festhalten.md) | Entscheidungen als ADR festhalten | accepted |
| [0002](0002-beads-als-issue-tracker.md) | Beads als Issue-Tracker für Agent-Arbeit | accepted |
| [0003](0003-turborepo-pnpm-monorepo.md) | Monorepo mit Turborepo und pnpm | accepted |
| [0004](0004-cicd-catladder-github-cloud-run.md) | CI/CD mit catladder, GitHub Actions und Cloud Run | accepted |
| [0005](0005-prisma-als-orm.md) | Prisma als ORM | accepted |
| [0006](0006-pr-pro-bead-agents-mergen.md) | PR pro Bead, Agents mergen bei grüner CI | superseded by 0008 |
| [0007](0007-landing-page-v1-englisch-ohne-datenspeicherung.md) | Landing Page v1: Englisch, ohne Datenspeicherung | accepted |
| [0008](0008-gas-city-refinery-merge-queue.md) | Gas City mit Gastown-Refinery als Merge-Queue | accepted |
| [0009](0009-vision-und-ideenpool.md) | Produktvision als lebendes Dokument, Ideen als Beads | accepted |
| [0010](0010-art-direction-welt-pixel-art-ui-offen.md) | Art Direction: Welt in Pixel-Art, UI-Stil offen | accepted |
| [0011](0011-multiplayer-netcode.md) | Multiplayer und Netcode für Welten als Instanzen | proposed |
| [0011](0011-englisch-fuer-readmes-prs-commits.md) | Englisch für READMEs, PRs, Commits und Code-Kommentare | accepted |
