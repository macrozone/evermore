# Fonts

Both fonts are self-hosted (no requests to Google Fonts or similar) and are loaded via `next/font/local` in [`../fonts.ts`](../fonts.ts). Only the Latin subset is included (UI texts are in English, see ADR 0007).

| Font | Usage | File | License | Copyright |
|---|---|---|---|---|
| [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) | Headings, buttons (`font-display`) | `press-start-2p/press-start-2p-latin-400-normal.woff2` | [SIL OFL 1.1](press-start-2p/OFL.txt) | 2012 The Press Start 2P Project Authors (cody@zone38.net), Reserved Font Name «Press Start 2P» |
| [VT323](https://fonts.google.com/specimen/VT323) | Body text (`font-body`) | `vt323/vt323-latin-400-normal.woff2` | [SIL OFL 1.1](vt323/OFL.txt) | 2011 The VT323 Project Authors (peter.hull@oikoi.com) |

Source: npm packages [`@fontsource/press-start-2p`](https://www.npmjs.com/package/@fontsource/press-start-2p) and [`@fontsource/vt323`](https://www.npmjs.com/package/@fontsource/vt323), version 5.3.0 (their source: Google Fonts). The `.woff2` files are copied unchanged; the license text sits next to each as `OFL.txt`.

## What the OFL allows

- Use, embedding and redistribution (including commercial) are allowed; the license text must be included – that is why `OFL.txt` sits next to each font file.
- The fonts may not be sold on their own.
- If a font is modified (e.g. custom glyphs), the derived font may not carry the "Reserved Font Name".

Only add new fonts with a free license (OFL or similar) and list them here.
