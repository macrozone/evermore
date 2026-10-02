# 0006 – PR pro Bead, Agents mergen bei grüner CI

- Status: accepted
- Datum: 2026-10-02
- Entscheider: maw

## Kontext und Problem

Agents setzen Beads parallel um. Es braucht eine Regel, wie ihre Arbeit auf `main` kommt und wann ein Bead als erledigt gilt.

## Betrachtete Optionen

- Feature-Branch pro Epic, ein PR am Schluss, Mensch merged
- PR pro Bead, Mensch merged
- PR pro Bead, Agent merged selbst bei grüner CI

## Entscheidung

Gewählt: **PR pro Bead, der Agent merged selbst, sobald alle Pflicht-Checks grün sind.** Maximales Tempo; Review durch Menschen erfolgt nachträglich (Review-App, dev-Environment, Code).

Ablauf:

1. Branch `bead/<bead-id>-<slug>` von aktuellem `main`, eigener Worktree.
2. Commits und PR-Titel enthalten die Bead-ID; PR-Beschreibung verweist auf Bead und relevante ADRs.
3. Merge (Squash) nur, wenn alle **Pflicht-Checks** grün sind: Build, Lint, Typecheck, Test. Deploy-Jobs zählen nicht dazu, solange GCP nicht angebunden ist (evermore-b4t.1).
4. Nach dem Merge schliesst der Agent das Bead (`bd close <id> --reason "PR #<n> gemerged"`).

## Konsequenzen

- Positiv: kein Warten auf Menschen; Bead-Status entspricht dem Stand auf `main` (Bead wird erst nach Merge geschlossen).
- Negativ / Risiken: ungeprüfter Code auf `main`. Die Qualität hängt an der CI – Tests sind Teil jedes Akzeptanzkriteriums, keine Merges mit roten oder übersprungenen Checks.
- Nötig: Branch-Protection auf `main` mit Pflicht-Checks und Squash-Merge (Mensch, evermore-7wc.6). Bis dahin prüft der Agent die Checks selbst (`gh pr checks`).
- Fehler auf `main` werden per Revert-PR korrigiert, nie per Force-Push.
