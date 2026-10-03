# Moodboard 6 – UI & HUD

The UI is **not** pixel UI by default (ADR 0010). maw's main direction is the design language of books: simple and elegant, with an ornate cover frame, gold filigree, corner fittings, parchment and leather tones and classic serif book typography. It sits crisp and high-resolution on top of a pixel-art game scene and stays in the background: the HUD as a subtle frame with HP and "Inspiration", the inventory as an open book, the wish dialog as a single book page with a quill. For comparison there is an alternative in a modern, calm, minimalist design (frosted glass, sans-serif, one accent).

Moodboards are append-only: every iteration is kept and shows how the direction evolved.

## Iteration 1 (2026-10-03, axis-aligned top-down view in the background)

The game scenes in the background were already generated with maw's perspective guideline (axis-aligned top-down view like *Stardew Valley*, *Zelda: A Link to the Past*).

**Main direction: book design language**

| Image | Description |
|---|---|
| `buch-hud.jpg` | Fine golden cover frame with leather corner fittings around the garden scene; top left an HP bar and an inkwell gauge "Inspiration" in a serif font, bottom right a book icon as the menu. |
| `inventar-buchseite.jpg` | Inventory as an open book with a ribbon bookmark, item grid in engraved frames on the left, detail illustration on the right – first attempt (with filler text). |
| `inventar-buchseite-v2.jpg` | Second attempt: same principle, richly ornamented right page, placeholder lines instead of text, red silk ribbon. |
| `wunsch-dialog.jpg` | Wish dialog as a single parchment page with golden vines, an empty writing line and a quill, below it an ornamented "Inspiration" bar; HP as a heart emblem top right. |

**Alternative: modern minimalist**

| Image | Description |
|---|---|
| `alternative-minimal.jpg` | First attempt – the generator rendered it as a side-by-side comparison with the headings «Alternative Direction / Original Direction» (pixel UI on the right); do not use as a guideline. |
| `alternative-minimal-v2.jpg` | Second attempt: one frosted-glass panel top left with HP and Inspiration bars in sans-serif, three round outline icons bottom right. |

Notes:
- `inventar-buchseite.jpg` contains lorem ipsum filler text (brief: short labels only) → `-v2` generated. In `-v2` the placeholder lines are rendered as scribbles.
- `alternative-minimal.jpg` is a split comparison with headings instead of a single scene → `-v2` generated.
- In `buch-hud.jpg` and `inventar-buchseite-v2.jpg` frames and icons came out slightly "pixelated" in places; the typography, however, is consistently serif-based and high-resolution.
- The images are JPEG (`.jpg`); the tool had named them `.png`, renamed on 2026-10-03.

## Color mood

Computed with k-means over the images of the main direction (Python, without Pillow; images downscaled with `sips`); gold estimated.

| Hex | Role |
|---|---|
| `#D6C29C` | parchment |
| `#8F6F4C` | leather, aged paper |
| `#52392B` | dark leather, wood |
| `#C9A44C` | gold filigree, frame lines (estimated) |
| `#B3262B` | HP red, silk ribbon (estimated) |
| `#223937` | game scene night green |
| `#211F21` | dimming behind menus |

Alternative (minimal): `#20252C` (glass panel), `#E8A85A` (amber accent, estimated), `#8E9BF0` (Inspiration blue, estimated), `#3E483E` (scene).

## References

- Classic bookbinding: ornate bindings, gold embossing, filigree, bookplates, ribbon bookmarks
- Serif book typography (e.g. Garamond/Caslon-like)
- Game scenes: *Stardew Valley*, *Zelda: A Link to the Past*
- Alternative: contemporary minimalist game HUDs (frosted glass, one accent color)

## Prompts

**buch-hud.jpg**
```
Game UI mockup screenshot, 16:9. Background: a pixel-art game scene in 16-bit SNES action RPG style with modern soft lighting — a cozy cottage garden at dusk, CAMERA axis-aligned orthographic top-down like Stardew Valley and Zelda: A Link to the Past (not isometric), a small player character in the middle. Overlaid UI is NOT pixel art: it is crisp, high-resolution, elegant and minimal, inspired by the design language of old books: thin ornate gilded filigree frame lines, small embossed corner ornaments like a book cover, parchment and dark leather tones, refined serif typography. Top-left: a slim ornamented HP bar labeled "HP" in a classic serif font. Below it a delicate golden ink-well style gauge labeled "Inspiration", softly glowing. Bottom-right: a small closed ornate book icon as a menu button. UI is subtle, small and stays out of the way; the world remains the star. No other text.
```

**inventar-buchseite.jpg**
```
Game UI mockup screenshot, 16:9. Background: a pixel-art game scene (16-bit SNES action RPG style, modern lighting, axis-aligned orthographic top-down camera like Stardew Valley, not isometric) of a cozy cottage interior, dimmed and slightly blurred behind the menu. In front: an inventory screen designed as an open antique book — two parchment pages inside a dark leather cover with gilded, embossed ornamental border and corner fittings, a silk ribbon bookmark. Left page: an elegant grid of item slots drawn as thin engraved ink frames with small pixel-art item icons inside (potion, key, lantern, apple, feather quill). Right page: a larger illustration of the selected item and a few lines of elegant serif typography as placeholder. Headline at top of the left page in a classic book serif: "Inventory". UI rendered in crisp high resolution, not pixel font; calm, refined, readable. No other readable text besides "Inventory".
```

**inventar-buchseite-v2.jpg**
```
Game UI mockup screenshot, 16:9. Background: a pixel-art game scene (16-bit SNES action RPG style, modern warm lighting, axis-aligned orthographic top-down camera like Stardew Valley, not isometric) of a cozy cottage interior, dimmed behind the menu. In front: an inventory screen designed as an open antique book — two parchment pages inside a dark leather cover with gilded embossed ornamental border and corner fittings, a silk ribbon bookmark. Left page: a grid of item slots drawn as thin engraved ink frames with small pixel-art item icons (potion, key, lantern, apple, feather quill). Right page: a larger illustration of the selected lantern above a decorative ornamental flourish divider and a few faint wavy grey placeholder lines (no actual words). Headline at the top of the left page in a classic book serif: "Inventory". UI crisp high resolution, not pixel font; calm and refined. The ONLY text in the whole image is the single word "Inventory" — no lorem ipsum, no paragraphs, no other words.
```

**wunsch-dialog.jpg**
```
Game UI mockup screenshot, 16:9. Background: a pixel-art night scene in 16-bit SNES action RPG style with modern soft lighting, a forest clearing with a glowing stone pedestal, axis-aligned orthographic top-down camera like Zelda: A Link to the Past (not isometric). Overlaid at the bottom center: a wish-writing dialog styled as a single page torn from an ornate book — cream parchment with an elegant gilded vine filigree border, a small embossed emblem at the top, an empty handwriting line with a feather quill cursor, and below a slim ornamented progress bar labeled "Inspiration" in a refined serif font, half filled with soft golden light. Top-right: a minimal ornamented heart-shaped emblem with "HP". UI is crisp high resolution, elegant book typography, not pixel art, not cluttered. Only the labels "Inspiration" and "HP" as text.
```

**alternative-minimal.jpg**
```
Game UI mockup screenshot, 16:9, alternative direction for comparison. Background: a pixel-art game scene in 16-bit SNES action RPG style with modern soft lighting, a cozy cottage garden at dusk, axis-aligned orthographic top-down camera like Stardew Valley (not isometric), small player character. Overlaid UI: modern, calm, minimalist — thin clean lines, translucent dark frosted-glass panels with rounded corners, generous spacing, a single soft accent color (warm amber), clean modern sans-serif typography, no ornaments. Top-left: slim HP bar labeled "HP" and a thin glowing bar labeled "Inspiration". Bottom-right: three small circular icon buttons. Very subtle, the world remains the star. Crisp high resolution UI, not pixel art. Only the labels "HP" and "Inspiration" as text.
```

**alternative-minimal-v2.jpg**
```
A single full-screen game screenshot (not a comparison, not split, no headings, no captions). Pixel-art game scene in 16-bit SNES action RPG style with modern soft lighting: a cozy cottage garden at dusk with lanterns, axis-aligned orthographic top-down camera like Stardew Valley (not isometric), a small player character in the center. Overlaid HUD in a modern, calm, minimalist style: one small translucent dark frosted-glass panel with rounded corners in the top-left containing a slim warm-amber HP bar labeled "HP" and a thin softly glowing bar labeled "Inspiration" in a clean modern sans-serif; three small circular outline icon buttons in the bottom-right (bag, map, gear). No ornaments, thin lines, generous spacing, crisp high-resolution UI, not pixel art. The only text in the image: "HP" and "Inspiration".
```
