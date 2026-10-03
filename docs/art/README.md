# Evermore – Art Bible

> Yardstick for all visual decisions and for reviews by the art director (`.claude/agents/art-director.md`). Basis: [ADR 0010](../adr/0010-art-direction-welt-pixel-art-ui-offen.md) and [Vision, section 5](../vision.md#5-look--feel). Living document: when maw disagrees with a review or sets something new, it is added here as a rule (with date). Points marked *open* are not decided.

## 1. Core principles

- **The world is the star.** Pixel art reminiscent of SNES role-playing games, but allowed to be modern.
- **Cozy home.** The player's own home feels safe and warm – unless the player explicitly wants something else.
- **Light tells the story.** Light sources visibly light up their surroundings; light and shadow give depth and mood.
- **Consistent despite generation.** Generated content and content requested by players must fit together stylistically. The pixel look stylizes and holds it together.

## 2. World

| Topic | Rule |
|---|---|
| Style | Pixel art, SNES-inspired; modern touches allowed: dynamic light, soft shadows, particles, smooth animation |
| References | SNES RPGs, *Children of Morta*, *Stardew Valley* (more *open*) |
| Colors | No fixed 16-color limit. Harmonious, rather warm base mood in the player's own world; palettes per world/biome allowed |
| Pixel density | Uniform within a scene (characters, objects, terrain have the same pixel size); no mixed resolutions |
| Perspective | **Axis-aligned top-down view** like *Stardew Valley*, *Secret of Mana*, *Zelda: ALttP* (orthographic, looking from the south, edges horizontal/vertical), with real verticality. 45° isometric remains a later option. |
| Light | Light sources (fire, lanterns, windows, magic) with a visible light cone/falloff; directional shadows; day/night possible (*open*) |
| Readability | Walkable vs. impassable terrain distinguishable at a glance; the player character always stands out; occlusion by trees/buildings is semi-transparent instead of hiding the player |

### Moods

| Area | Effect | Reference |
|---|---|---|
| Own world | warm, familiar, alive; depending on the player's description | Stardew Valley, SNES RPGs |
| Dream world | empty, floating, narrow paths in the void | Chaos in *Hades* |
| Shadow world | familiar but distorted and threatening; the same shapes as the player's own world, twisted | Dark World (*Zelda: ALttP*), Upside Down (*Stranger Things*) |

## 3. UI

- Style **open** (decision `evermore-azi`). **Not** automatically a pixel look; pixel fonts and a 16-color palette are not a UI standard (ADR 0010).
- First direction from maw: **design language of books** – simple, elegant, ornate cover (ornaments, frames, embossing, book typography).
- The UI stays behind the world; easy to read.

## 4. Do's & don'ts

**Do**
- Warm light and small, familiar details around the home.
- Let light sources shine – especially at night.
- Uniform pixel size and clear silhouettes.

**Don't**
- Pixel fonts and retro palettes for the entire UI.
- Mixed resolutions or blurred (smoothly scaled) pixels.
- A flat, unlit look without shadows.

## 5. Review criteria (for the art director)

1. Does it fit the core principles (world as the star, cozy, light tells the story, consistent)?
2. World style: SNES feel, done in a modern way, consistent pixel density?
3. Light and shadow: light sources visible, mood matching the area?
4. Readability: terrain, player character, occlusion?
5. UI: does it follow the open direction (book design language) and stay in the background?
6. What is missing from this Art Bible to judge it? → as a question to maw.

## 6. Changelog

- 2026-10-03: Perspective set: axis-aligned top-down view instead of 45° isometric (maw). Rationale includes: generated images are easier to convert into tiles/sprites/voxels this way. Moodboards are append-only (iterations stay visible).
- 2026-10-02: First version based on ADR 0010 and the vision (light, day/night, cozy home, UI direction book).
