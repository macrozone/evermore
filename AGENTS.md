# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

> **Architecture in one line:** Issues live in a local Dolt database
> (`.beads/dolt/`); cross-machine sync uses `bd dolt push/pull` (a
> git-compatible protocol), stored under `refs/dolt/data` on your git
> remote — separate from `refs/heads/*` where your code lives.
> `.beads/issues.jsonl` is a passive export, not the wire protocol.
>
> See [SYNC_CONCEPTS.md](https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md)
> for the one-screen overview and anti-patterns (don't treat JSONL as the
> source of truth; don't `bd import` during normal operation; don't
> reach for third-party Dolt hosting before trying the default).

# Evermore – Projektrichtlinien

Evermore ist ein Online-Action-Rollenspiel mit einer Welt in Pixel-Art (SNES-inspiriert, darf modern sein; UI-Stil offen, siehe ADR 0010) und starkem User Generated Content (Experimentierphase). Turborepo-Monorepo (`apps/*`, `packages/*`), Code auf GitHub, CI/CD via catladder auf Google Cloud Run. Englisch: Code, UI-Texte, Code-Kommentare, Commit-Messages, Pull Requests und alle READMEs; Deutsch: Beads, Vision, ADRs (ADR 0012).

Die Produktvision steht in [`docs/vision.md`](docs/vision.md) – vor grösseren Features lesen; offene Punkte dort nicht selbst entscheiden.

Diese Richtlinien gelten für alle Menschen und Agents und gehen den generierten Beads-Blöcken weiter unten vor.

## Entscheidungen festhalten

Vor der Arbeit: relevante ADRs in [`docs/adr/`](docs/adr/README.md) lesen. Ihnen nicht widersprechen.

- **Projektweite Entscheidungen** (Architektur, Technologie, Prozess, Produkt-Scope) werden als ADR in `docs/adr/NNNN-titel.md` festgehalten (MADR, Vorlage `docs/adr/template.md`, Index in `docs/adr/README.md` nachführen). Angenommene ADRs nicht umschreiben – eine Änderung ist eine neue ADR, die die alte ablöst (`superseded by`).
- **Aufgabenspezifische Entscheidungen** gehören ins betroffene Bead (`bd update <id> --design/--notes`).
- **Projektweite Konventionen**, die jede Session kennen muss, zusätzlich als `bd remember` (mit Verweis auf die ADR).
- **Offene Entscheidung entdeckt?** Nicht selbst entscheiden, wenn sie über die eigene Aufgabe hinausgeht oder einer ADR widerspricht: Bead anlegen (`bd create "Entscheidung: …" -t decision -d "<Kontext, Optionen, Empfehlung>"`), danach separat `bd label add <neu> human`, die eigene Aufgabe damit blockieren (`bd dep add <eigene> --blocked-by <neu>`), eigene Aufgabe auf `open` zurücksetzen und mit der nächsten Arbeit weitermachen.
- **Planungs- und Chat-Sessions:** Jede Entscheidung, die im Gespräch fällt, wird vor Ende der Session als ADR bzw. ins Bead zurückgeschrieben. Was nur im Chat steht, gilt als nicht entschieden.

## Beads schreiben

Wer Beads anlegt (Planung, Mensch, Agent), gibt prüfbare Akzeptanzkriterien mit (`--acceptance`): was man sieht bzw. messen kann, inkl. Interaktion (Regler, Scrollen, Zoom, Zeit). Fehlen sie, ergänzt sie der Polecat beim Kontext-Lesen (siehe Arbeitsablauf).

## Ideen einbringen

Evermore soll organisch um die [Vision](docs/vision.md) wachsen. Eigene Ideen und Inspirationen von Agents sind ausdrücklich erwünscht.

- **In Experimenten frei:** In `/lab`-Aufgaben (Label `experiment`) dürfen Agents eigene Ansätze und Varianten ausprobieren, solange die Akzeptanzkriterien erfüllt sind. Erkenntnisse gehören in die Notiz des Beads.
- **Ideen festhalten:** Was über die eigene Aufgabe hinausgeht (Spielmechanik, Story, Look, Technik), als Idee-Bead erfassen: `bd create "Idee: …" -t feature -p 4 -d "<Idee; Bezug zur Vision (Abschnitt); warum sie passt; grobe Umsetzung>" --deps discovered-from:<eigene>`, danach separat `bd label add <neu> idee` und `bd defer <neu>` (zurückgestellt, damit sie nicht automatisch umgesetzt wird).
- **Passung benennen:** Ideen sollen zu den Säulen der Vision passen. Ideen, die die Vision erweitern oder ihr widersprechen, sind willkommen – das aber ausdrücklich so benennen.
- **Nicht selbst umsetzen:** Umgesetzt wird erst, was maw annimmt. `docs/vision.md` ändern Agents nur, wenn ein Bead das ausdrücklich verlangt.
- Vor dem Erfassen kurz `bd list -l idee --all` prüfen, um Duplikate zu vermeiden; bestehende Ideen lieber per Kommentar ergänzen.

## Experimente und Design: kleine Iterationen

Ziel: maw sieht Ergebnisse schnell und kann früh die Richtung ändern.

- **Scheiben statt grosser Beads:** Experimente und Design-Aufgaben in Scheiben schneiden, die einzeln mergebar und in unter einer Stunde sichtbar sind (z.B. erst statisch rendern, dann Look, dann Bewegung). Zu grosse Beads beim Planen aufteilen; merkt ein Polecat, dass sein Bead zu gross ist, liefert er die erste sinnvolle Scheibe und legt den Rest als Folge-Beads an.
- **Regler statt Rückfragen:** Experimentseiten unter `/lab` bekommen ein Einstell-Panel (z.B. Tweakpane) für die wichtigen Parameter; die aktuellen Werte sind als JSON kopierbar. Ergebnis und Regler sind **immer gleichzeitig sichtbar** (Panel als Overlay über dem Canvas bzw. daneben, nie darunter wegscrollen), damit man beim Ändern direkt sieht, was passiert (maw, 2026-10-03). Jede Seite mit Echtzeit-Rendering zeigt einen FPS-Zähler (FPS, Frame-Time; bei 3D zusätzlich Dreiecke/Draw-Calls).
- **Modellauswahl bei Generatoren:** Jede Lab-Seite, die ein Modell aufruft, bekommt eine Modellauswahl im Panel (Stufen Pro / Flash / Flash-Lite). Defaults: Bild `gemini-3.1-flash-lite-image`, Text `gemini-3.5-flash-lite` (maw, 2026-10-03). Modell, Latenz und Kosten pro Aufruf anzeigen.
- **Auf der Startseite verlinken:** Jede neue `/lab`-Seite, jedes Moodboard und jede Design-Seite wird in der zentralen Registry eingetragen, damit sie auf `/` erscheint.
- **Selbst anschauen, nicht nur testen (Pflicht bei sichtbaren Ergebnissen):** Grüne Tests und Build reichen nicht. Vor der Übergabe das Ergebnis headless im Browser prüfen und die Screenshots selbst ansehen: Startzustand, nach dem Scrollen (Panels/Texte überlappen nicht), nach Interaktion mit den wichtigsten Reglern, bei Extremwerten (z.B. Zoom min/max) und – bei Animationen – nach Ablauf von Zeit ohne Interaktion (es bewegt sich wirklich). Wo möglich als Playwright-Check im Repo festhalten (z.B. Pixel ändern sich über die Zeit, Bounding-Boxes überlappen nicht, Canvas nicht leer). Gefundene Mängel vor der Übergabe beheben oder als Folge-Bead erfassen.
- **Ergebnis mit Bild:** Zum Abschluss einer Scheibe ein Kommentar im Bead mit Screenshot, 2–3 Sätzen «worauf achten» und offenen Fragen. Screenshot nur headless: `pnpm screenshot /lab/<seite> [--wait ms] [--out datei.png]` (Setup und Details: [README](README.md#headless-lab-screenshots)). **Nie Desktop-Steuerung** (Computer Use, Browser-Bridges, macOS-Berechtigungen anfragen). Geht kein headless Screenshot, trotzdem an die Refinery übergeben und im Kommentar «Screenshot fehlt» vermerken – die Planungs-Session ergänzt ihn nach dem Merge. Ein fehlender Screenshot blockiert nie die Übergabe.
- **Feedback lesen:** Vor jeder Scheibe die Kommentare im Bead, im Eltern-Epic und in der vorherigen Scheibe lesen – dort steht maws Rückmeldung.
- **Art-Director-Review:** Visuelle Ergebnisse (Welt, UI, Moodboards) werden gegen die [Art Bible](docs/art/README.md) geprüft. In Claude-Sessions per Subagent `art-director` (`.claude/agents/art-director.md`); Reviews sind Vorschläge, maw entscheidet. Polecats rufen ihn nur auf, wenn ihr Bead es verlangt.
- **Suchen und Gestalten** geschieht in interaktiven Studio-Sessions (Mensch + Agent mit Live-Preview); deren Entscheidungen landen im Bead bzw. in einer ADR, klar umrissene Folgearbeit geht als Beads an die Polecats.

## Arbeitsablauf für Agents (Gas City + Refinery)

Umgesetzt wird über **Gas City mit dem Gastown-Pack** ([ADR 0008](docs/adr/0008-gas-city-refinery-merge-queue.md)). Polecats bearbeiten je ein Bead in einem eigenen Worktree und Feature-Branch; die **Refinery** ist die einzige Instanz, die nach `main` merged (eins nach dem anderen, nach Rebase und lokalen Checks). Für diese Arbeit gilt das Profil **Team-maintainer**: Polecats committen und pushen ihren Branch, die Refinery merged und schliesst das Bead. Die Schritte der Gas-City-Formula (`mol-polecat-work`, `mol-refinery-patrol`) gehen für die Mechanik vor; diese Richtlinien ergänzen sie. Eine aktuelle Anweisung eines Menschen («nicht committen/pushen») geht immer vor. Interaktive Sessions mit Menschen (Planung, Chat) bleiben beim konservativen Profil: committen/pushen nur auf Anweisung.

Für Polecats:

1. **Kontext lesen:** `bd show <id>` inkl. Akzeptanzkriterien und Design-Notes, Kommentare geschlossener Blocker (dort stehen Antworten auf Fragen), relevante ADRs. **Akzeptanzkriterien schärfen:** Sind sie vage oder fehlen sie (v.a. bei sichtbaren Ergebnissen), vor dem Umsetzen konkrete, prüfbare Kriterien ableiten und ins Bead schreiben (`bd update <id> --acceptance "…"`) – inkl. Interaktions-, Scroll-, Extremwert- und Zeit-Checks (siehe «Selbst anschauen»).
2. **Umsetzen:** Akzeptanzkriterien erfüllen, Tests gehören dazu. Generierte catladder-Dateien nie von Hand ändern (`catladder.ts` + `pnpm catenv`).
3. **Rückfragen:** wie oben unter «Offene Entscheidung» – Frage-Bead mit Label `human`, eigene Aufgabe blockieren, nicht raten.
4. **Commits** enthalten die Bead-ID. Nie selbst nach `main` mergen oder pushen – Übergabe an die Refinery gemäss Formula.
5. **Folgearbeit** als neue Beads (`--deps discovered-from:<id>`, Labels separat setzen); eigene Ideen siehe «Ideen einbringen».

Nach jedem Merge löst die City ein **Code-Review** aus (Review-Bead «Code-Review: <id> …», Label `review`; Kernbausteine mit Label `area:infra`/`core` reviewt der jeweils andere Anbieter). Reviewer schreiben nur Berichte; Folge-Beads aus Reviews legt die Planung an. Wer Kernbausteine baut (Weltmodell, Bewegung, Generator, Infrastruktur), setzt das Label `core`.

Die GitHub-CI (catladder) ist optional und keine Merge-Voraussetzung. Fehler auf `main` per Revert, nie Force-Push.

Abhängigkeiten immer mit `bd dep add <issue> --blocked-by <vorgänger>` setzen (`--deps blocks:X` bedeutet das Gegenteil).

## Dauerhafte main-Vorschau

`pnpm preview:main start` startet die Vorschau von `origin/main` im Hintergrund
auf `http://localhost:3900` (Dev-Index `:3990`). Der dedizierte Worktree liegt
standardmässig neben dem Hauptcheckout unter `../evermore-preview` und bleibt
auf detached HEAD. `pnpm preview:main update` aktualisiert ihn ohne Neustart
des Dev-Servers; für automatisierte Updates nach Refinery-Merges diesen Befehl
verwenden. Konfiguration: `PREVIEW_MAIN_DIR`, `PREVIEW_MAIN_PORT` (bei beiden
Befehlen identisch). Keine manuellen Änderungen in diesem Preview-Worktree.
Details zu DB-Setup, Logs und Stoppen: [README.md](README.md#persistent-main-preview).

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## Lokale Ports und Worktrees

`pnpm catenv` vergibt vor der Env-Generierung einen stabilen `BASE_PORT` und
speichert ihn in der ignorierten Root-Datei `.env.local`. Der Hauptcheckout
nutzt 3000, verlinkte Worktrees einen freien 100er-Slot zwischen 4000 und 9900
(Hash des absoluten Pfads, bei belegtem Slot nächster freier Slot). Gespeicherte
Slots anderer Worktrees und lauschende Ports werden bei der Erstvergabe
ausgelassen. Ein vorhandener Slot bleibt auch bei laufenden Diensten erhalten.
Ein expliziter `BASE_PORT` hat Vorrang; nach einem manuellen Wechsel `pnpm catenv`
erneut ausführen. Zur Neuvergabe den Eintrag in `.env.local` löschen.

| Dienst | Port |
|---|---|
| www | `BASE_PORT + 0` |
| Postgres | `BASE_PORT + 30` |
| Cloud-Tasks-Emulator | `BASE_PORT + 31` |
| Dev-Index (reserviert) | `BASE_PORT + 90` |

`catladder/localPorts.ts` ist die zentrale Offset-Definition. catladder schreibt
die lokalen Variablen in `apps/www/.env` und `apps/local-development/.env`.
Compose nutzt `evermore-<BASE_PORT>` als Projektname und damit ein eigenes
DB-Volume je Slot. `pnpm dev` führt `catenv` aus und lädt den Root-Port vor Turbo.
Für die einzelnen `services:up/down/reset`-Befehle zuerst `pnpm catenv` im Root
ausführen. Unterschiedliche Worktrees dürfen nicht denselben manuellen Slot
verwenden; die automatische Erstvergabe parallel neu angelegter Worktrees
bitte nacheinander ausführen.
