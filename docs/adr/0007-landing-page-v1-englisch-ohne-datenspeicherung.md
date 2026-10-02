# 0007 – Landing Page v1: Englisch, ohne Datenspeicherung

- Status: accepted
- Datum: 2026-10-02
- Entscheider: maw
- Bead: evermore-0lb

## Kontext und Problem

Die erste öffentliche Seite soll die Spielidee vermitteln. Offen waren Sprache und ob Interessenten-E-Mails schon gespeichert werden.

## Betrachtete Optionen

- Sprache: Englisch / Deutsch / beides mit i18n
- Warteliste: E-Mails speichern (mit Datenschutzhinweis) / nur Call-to-Action ohne Speicherung

## Entscheidung

Gewählt: **Englisch**, keine i18n-Infrastruktur vorerst. **Keine Speicherung von E-Mails** in v1 – der Call-to-Action zeigt «Coming soon».

## Konsequenzen

- Positiv: keine Datenschutzerklärung und keine Produktions-Datenbank nötig für den Start.
- Negativ: noch keine Interessenten-Liste.
- UI-Texte im Produkt sind englisch; Code englisch; Beads und Doku deutsch.
- Warteliste-Task (evermore-0lb.3) ist zurückgestellt; `packages/db` startet mit Platzhalter-Schema.
