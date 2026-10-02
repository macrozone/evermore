# 0002 – Beads als Issue-Tracker für Agent-Arbeit

- Status: accepted
- Datum: 2026-10-02
- Entscheider: maw

## Kontext und Problem

Arbeit soll von Menschen vorbereitet und von Coding-Agents parallel umgesetzt werden. GitHub/GitLab-Issues bieten keine Abhängigkeits-gesteuerte Queue, kein atomares Claimen und sind für Agents umständlich.

## Betrachtete Optionen

- GitHub Issues
- Beads (`bd`, Dolt-basiert) mit Scotty als UI, später Gas City als Orchestrator
- Linear/Jira

## Entscheidung

Gewählt: **Beads**. `bd ready` liefert nur unblockierte Arbeit, `--claim` ist atomar, Epics/Abhängigkeiten/Akzeptanzkriterien sind eingebaut, Fragen an Menschen laufen über Beads mit Label `human`.

## Konsequenzen

- Positiv: Agents organisieren sich über die Queue; Reihenfolge entsteht aus Abhängigkeiten.
- Negativ: Sync zwischen Rechnern ist ohne zentralen Dolt-Server konfliktanfällig (getestet am 2026-10-02); Schliessen nach Merge und Benachrichtigungen sind nicht eingebaut und werden über Prozess (ADR 0006) gelöst.
- Beads-Version im Team und bei Agents einheitlich halten (Schema-Migrationen).
