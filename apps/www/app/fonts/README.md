# Schriften

Beide Schriften sind self-hosted (keine Requests an Google Fonts o. Ä.) und werden über `next/font/local` in [`../fonts.ts`](../fonts.ts) eingebunden. Enthalten ist jeweils nur das Latin-Subset (UI-Texte sind englisch, siehe ADR 0007).

| Schrift | Verwendung | Datei | Lizenz | Copyright |
|---|---|---|---|---|
| [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) | Überschriften, Buttons (`font-display`) | `press-start-2p/press-start-2p-latin-400-normal.woff2` | [SIL OFL 1.1](press-start-2p/OFL.txt) | 2012 The Press Start 2P Project Authors (cody@zone38.net), Reserved Font Name «Press Start 2P» |
| [VT323](https://fonts.google.com/specimen/VT323) | Fliesstext (`font-body`) | `vt323/vt323-latin-400-normal.woff2` | [SIL OFL 1.1](vt323/OFL.txt) | 2011 The VT323 Project Authors (peter.hull@oikoi.com) |

Bezugsquelle: npm-Pakete [`@fontsource/press-start-2p`](https://www.npmjs.com/package/@fontsource/press-start-2p) und [`@fontsource/vt323`](https://www.npmjs.com/package/@fontsource/vt323), Version 5.3.0 (Quelle dort: Google Fonts). Die `.woff2`-Dateien sind unverändert übernommen, der Lizenztext liegt jeweils als `OFL.txt` daneben.

## Was die OFL erlaubt

- Nutzung, Einbettung und Weitergabe (auch kommerziell) sind erlaubt; der Lizenztext muss mitgeliefert werden – deshalb liegt `OFL.txt` neben jeder Schriftdatei.
- Die Schriften dürfen nicht einzeln verkauft werden.
- Wird eine Schrift verändert (z. B. eigene Glyphen), darf die abgeleitete Schrift den «Reserved Font Name» nicht tragen.

Neue Schriften nur mit freier Lizenz (OFL o. Ä.) aufnehmen und hier eintragen.
