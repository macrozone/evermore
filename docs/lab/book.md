# Book of Evermore – erste UI-Scheibe

Bead: `evermore-1fo.7.1`; Route: `/lab/book`, Eintrag in der zentralen Registry.

Die zwei Fragen führen zur lesbaren Zusammenfassung; beide Antworten bleiben beim Zurückblättern und Bearbeiten erhalten. Leere Antworten erlauben kein Weiterblättern. Antworten leben nur im Komponenten-State und gehen beim Verlassen oder Neuladen verloren; diese Scheibe generiert keine Welt.

Der Look bleibt lokal in `apps/www/app/lab/book/book.module.css`. Papier, Tinte und Akzent sind CSS-Variablen; das Einstellpanel steuert Schriftfamilie, Schriftgrösse, Buchbreite und Animationsdauer über weitere Variablen. JSON lässt sich kopieren oder bei gesperrter Clipboard-API manuell auswählen. Systemschriften halten die Studie unabhängig von den Pixel-Komponenten und zusätzlichen Font-Downloads. Unter 700px werden die Buchseiten untereinander dargestellt; reduzierte Bewegung deaktiviert die Animation.

## Bilder und Review

- [Desktop](screenshots/book-desktop.png)
- [Mobil, 390px](screenshots/book-mobile.png)

Worauf achten: Lesbarkeit längerer Antworten, ruhige Buchtypografie und der Übergang zwischen Frage und Zusammenfassung. Die warme Papierfarbe, zurückhaltende Ornamente und der dunkle Hintergrund folgen der vorläufigen Buch-Richtung der Art Bible (ADR 0010), ohne einen allgemeinen UI-Standard festzulegen.

Offene Review-Fragen an maw: Ist die Einband-Ornamentik ausreichend? Soll sich das Umblättern später körperlicher anfühlen? Ist die mobile Stapelansicht passend?

## Validierung

Frozen-Lockfile-Installation, Typecheck, Lint, vollständige Tests und Produktionsbuild erfolgreich. Headless Chromium gegen den Produktionsserver geprüft: leere/Whitespace-Antwort blockiert Weiter, beide Fragen, Zusammenfassung, Antwort-Erhalt beim Bearbeiten, Schriftumschaltung, JSON, Clipboard-Erfolg und manueller Fallback, kein horizontaler Overflow bei 390px, reduzierte Bewegung, Registry-Link und keine Browserfehler. Screenshots nach Abschluss der Animation aufgenommen.

Runtime meldet Node 23.6 statt der vorgesehenen Node-22-Version; alle Checks waren erfolgreich.
