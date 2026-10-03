# Architecture Decision Records (ADR)

Project-wide decisions (architecture, technology, process, product scope) are recorded here as ADRs – format: [MADR](https://adr.github.io/madr/), template: [template.md](template.md).

## Rules

- One file per decision: `NNNN-short-title.md`, numbered sequentially.
- Status: `proposed` → `accepted` | `rejected`; later possibly `superseded by NNNN`.
- The content of accepted ADRs is **not** changed anymore. Changing a decision = a new ADR; the old one gets `superseded by NNNN`.
- Open decisions are first recorded as a bead (`-t decision`, label `human`) and block the affected tasks. Once decided, the ADR is written, the bead links to it and is closed.
- Add new ADRs to the list below.

## Index

| No. | Title | Status |
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
