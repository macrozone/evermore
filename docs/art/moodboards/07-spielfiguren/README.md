# Moodboard 7 – Spielfiguren

Die Spielfigur entsteht aus der Antwort auf die Frage des Buchs «Who are you?» (Vision 3.1) – als Pixel-Art-Sprite mit allen Blickrichtungen und Laufanimation. Die vier Beispiele zeigen, wie verschieden diese Antworten ausfallen können: eine junge Kartografin mit Laterne, ein alter Fischer, eine Wüstennomadin und ein kleiner Waldgeist. Gemeinsam ist ihnen die SNES-Sprite-Anmutung: klare dunkle Outline, wenige Schattierungsstufen, gut lesbare Silhouette, kleiner Bodenschatten. Jede Figur trägt ein Erkennungsmerkmal (Laterne, gelber Ölmantel, Indigo-Tuch, Blatt auf dem Kopf), das sie auch klein auf dem Bildschirm unterscheidbar macht.

Moodboards sind append-only: Jede Iteration bleibt erhalten und zeigt die Entwicklung.

## Iteration 1 (2026-10-03, Ansichten für achsenparallele Draufsicht)

Bereits mit maws Perspektiv-Vorgabe erzeugt: Vorder-, Seiten- und Rückansicht passend zu einer achsenparallelen Kamera von «Süden» (wie *Stardew Valley*, *Secret of Mana*, *Zelda: A Link to the Past*), keine diagonalen 3/4-Ansichten. Pro Bild eine Reihe: vorne, Seite (rechts), hinten, Laufpose.

| Bild | Beschreibung |
|---|---|
| `kartografin.jpg` | Junge Kartografin mit rotbraunem Haar, grünem Reisemantel, Kartenrollen auf dem Rücken, Umhängetasche und leuchtender Messinglaterne. |
| `alter-fischer.jpg` | Alter Fischer mit weissem Bart, gelbem Südwester und Ölmantel, Gummistiefeln, Angelrute über der Schulter und Weidenkorb. |
| `wuestennomadin.jpg` | Wüstennomadin in Indigo- und Sandtönen mit Gesichtstuch, Goldreifen, Hirtenstab und Wasserkürbis. |
| `waldgeist.jpg` | Runder Waldgeist aus Moos und Rinde mit Blatt auf dem Kopf, grün leuchtenden Augen, Zweigärmchen und schwebenden Sporen. |

Auffälligkeiten:
- Die Nomadin ist schlanker und höher aufgelöst (feinere Proportionen) als die eher gedrungenen Chibi-Figuren Kartografin und Fischer – Pixeldichte zwischen den Bildern nicht ganz einheitlich. Für das Spiel muss eine feste Sprite-Grösse definiert werden.
- Der Fischer hält die Angelrute in Vorder- und Rückansicht nicht ganz konsistent (Seite wechselt).
- Die Bilder sind JPEG (`.jpg`); das Tool hatte sie als `.png` benannt, am 2026-10-03 umbenannt.

## Farbstimmung

Per k-Means über alle Figuren berechnet, grauer Hintergrund ausgefiltert (Python, ohne Pillow; Bilder via `sips` verkleinert).

| Hex | Rolle |
|---|---|
| `#251F20` | Outline, dunkelste Schatten |
| `#3F3F46` | Stiefel, Hosen, Schattierung |
| `#59382C` | Leder, Taschen, Holz |
| `#AB6422` | Haar, Laternenmessing |
| `#E4BE4E` | Ölmantel-Gelb, Laternenlicht, Gold |
| `#696646` | Moos, Mantelgrün im Schatten |
| `#646076` | Indigo-Stoffe |
| `#9C825E` | Sandtöne, Rinde |
| `#C6C5BD` | neutraler Hintergrund |

## Referenzen

- *Secret of Mana*, *Zelda: A Link to the Past* (Sprite-Proportionen, 4 Blickrichtungen)
- *Stardew Valley* (Figurenlesbarkeit, warme Farbgebung)
- Vision 3.1: Spielfigur aus «Who are you?» generiert

## Prompts

Alle vier Prompts folgen derselben Vorlage; nur die Figurenbeschreibung (und beim Waldgeist Grösse/Pose) unterscheidet sich.

**Vorlage**
```
Pixel art character sprite sheet in 16-bit SNES action RPG style (like Secret of Mana, Zelda: A Link to the Past, Stardew Valley), on a plain neutral light-grey background, no text, no labels. Character: <FIGUR>. Show the same character in a single horizontal row, evenly spaced and identical scale: 1) front view facing down/toward the camera, 2) side view facing right, 3) back view facing up/away, 4) walking pose (side view mid-stride). Views fit a top-down orthographic game camera seen from the south (axis-aligned, not isometric, no diagonal 3/4 angles). Chunky readable sprite about 32 pixels tall scaled up with crisp nearest-neighbor pixels, uniform pixel size, clean dark outline, soft shading, small drop shadow under each sprite.
```

**kartografin.jpg** – `<FIGUR>`:
```
a young cartographer girl with a rolled map tube on her back, short auburn hair, green traveling coat, satchel, holding a small glowing brass lantern
```

**alter-fischer.jpg** – `<FIGUR>`:
```
an old fisherman with a white beard, weathered yellow rain hat and oilskin coat, rubber boots, carrying a fishing rod over his shoulder and a small wicker basket
```

**wuestennomadin.jpg** – `<FIGUR>`:
```
a desert nomad woman wrapped in flowing indigo and sand-colored robes and a head scarf that covers her lower face, golden jewelry, a curved staff, a water gourd at her belt
```

**waldgeist.jpg** – `<FIGUR>` (zusätzlich «4) walking/hopping pose (side view)» und «about 24 pixels tall»):
```
a small forest spirit — a round little creature made of moss and bark with a leaf sprouting from its head, big glowing pale-green eyes, tiny twig arms, a few floating glowing spores around it
```
