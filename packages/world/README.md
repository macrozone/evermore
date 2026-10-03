# @evermore/world

World model v0 for the experiments from `evermore-1fo`: pure data, no rendering,
no framework. Generators produce a `World`, renderers read it.

Like `@evermore/core`, the package is consumed as TypeScript source **without a build step**
(`exports` points to `src/index.ts`); Next.js apps list it in
`transpilePackages`.

```ts
import { M, createMeadowHouseWorld, serializeWorld } from "@evermore/world";

const world = createMeadowHouseWorld();
world.getCell(12, 36, 3); // material ID
world.isWalkable(12, 45, 3); // player can stand here with their feet
world.heightAt(12, 36); // surface (here: roof)
world.heightAt(12, 36, 4); // ground below a player at z = 3
world.structuresAt(12, 36, 3); // [living room, house] – player is inside
const bytes = serializeWorld(world);
```

## Model

- **Coordinates:** x to the east, y to the south (down on screen),
  z up. A cell is a cube; the player position is the cell of the feet.
- **Cell grid:** bounded world (`width × depth × height`) made of chunks of 32×32×16
  cells, one `Uint16` material ID per cell (`0` = air). Chunks are only created on
  first write; `world.chunks()` returns them for chunk meshing.
- **Materials** (`MATERIALS`, IDs in `M`): `solid` (collision – water too),
  `walkable` (top side walkable), `opaque`, `occludesPlayer` (may occlude the
  player → render semi-transparent), `transparent`, `color` (0xRRGGBB) and
  `tileIndex` for 2D renderers. **IDs are part of the storage format: never renumber
  or reuse them, only append.**
- **Movement:** standing requires walkable ground and `PLAYER_HEIGHT` (2) free cells;
  without stairs the player can climb at most `MAX_STEP_HEIGHT` (1) cell. Stairs
  are therefore steps of one cell each; edges of two or more cells are cliffs.
- **Structures:** buildings, rooms and bridges as ID + bounding box (`min` inclusive,
  `max` exclusive), rooms with `parentId`. `structuresAt()` returns the innermost first.
- **Seeded RNG:** `createRng(seed)` (sfc32), `fork(label)` for independent,
  reproducible substreams.

## Serialization

`encodeWorld()` writes a binary format (version 1, see `src/serialization.ts`):
header, structures as JSON and, per non-empty chunk, the cells run-length encoded
(varints). `serializeWorld()` additionally compresses this with deflate
([fflate](https://github.com/101arrowz/fflate), synchronous, browser and Node).
`measureWorld()` returns the sizes raw / RLE / RLE + deflate.

## Test world `meadow-house`

`createMeadowHouseWorld()` (96×96×32): meadow with trees (trunks block, leaves
occlude), river with a bridge, hill with two height levels and stairs, on top a tower
with a spiral staircase to the platform, a two-storey house with two rooms per floor and inner stairs.
Spawn point in front of the front door. The tests use breadth-first search to check that everything is
reachable on foot – and that it is not without the bridge or stairs.

Measured size (test output): 589 824 B raw, 7 570 B RLE, **1 643 B** RLE + deflate.

Tests: `pnpm --filter @evermore/world test`.


## G1 procedural generator

`generateWorld(specification, seed)` builds a bounded world without renderer or
network dependencies. `WorldSpecificationSchema` is the Zod source for the
TypeScript type, local validation and exported `WORLD_SPECIFICATION_SCHEMA`.
`parseWorldSpecification` validates its supported fields and cross-field bounds
before allocating cells. Version 1 limits dimensions, density and building count
to keep client generation bounded. Both numbers and strings are supported seeds.

`repairWorldSpecification(value)` returns a validated specification and path-based
repair notes. It normalizes known CSS color names and short hex colors, discards
unknown palette entries, rounds/clamps cell coordinates, raises vertical bounds
and moves overlapping buildings or spawn to the nearest free position. It never
invents missing required fields or changes unsupported semantic enums. Repairs
are deterministic and leave the input untouched; crowded worlds that cannot fit
still fail validation.

The book API uses AI SDK structured output on Vertex, repairs before discarding
responses, and retries once with the failing path/rule inside a shared 12-second
deadline. The lab shows repair notes or the concrete fallback reason. Run its
opt-in ten-passage live acceptance check with local ADC:
`BOOK_LIVE_ACCEPTANCE=true pnpm --filter @evermore/www exec vitest run app/api/lab/book/generate.live.test.ts`.

`WORLD_EXAMPLES` includes Forest village, Harbour town, Desert ruins and Mountain
monastery. Try them at `/lab/g1-generator`, including generation timings and a
height slice that reveals interiors. Identical specifications and seeds produce
identical serialized worlds; timings are caller diagnostics and are not serialized.

The generator uses interpolated seeded value noise, river/sea masks, flat paved
routes, reserved foundations, vegetation and multistorey buildings. Buildings
have a ground-level door, four-cell floor spacing, alternating stairs with
headroom and a roof; each floor has a room region for renderer cutaways.
Paths connect the start to entrances and landmarks when enabled. Paths can bridge
water; terrain may still contain cliffs. This is an experimental scaffold:
climate, time, mood and palette remain semantic metadata, and landmarks use
placeholder stone columns. No permanent generation architecture is implied.

## Chunk and road research prototype

`generatePrototypeChunk(world, cx, cy)` explicitly generates one horizontal chunk
column from global coordinates and the world's seed. Existing allocated columns
are preserved. `connectPrototypePath(world, start, goal)` experiments with A*
roads on loaded terrain, preserving elevation and placing plank decks above water.
It returns the paved path or `null` without edits when no route is found.

This is separate from G1, with a fixed river fixture, fixed bridge height and a
bounded search budget. It does not provide unbounded storage or renderer streaming.
See [the research comparison and runnable example](../../docs/lab/chunks-and-paths-research.md)
for constraints, sources and proposed chunk boundary contracts.

## Shadow world experiment

`deriveShadowWorld(world)` returns an independent grid with the same occupied
cells, collision properties, spawn and named structures. Seed and coordinates
select purple shadow materials and darker decay patches; it does not regenerate
the layout or remove walls. Material IDs 21–60 are reserved for these variants.

`findInfluenceOrigin(world)` chooses the first bed in z/y/x order, falling back
to spawn. Read it from the source world. `influenceAt(position, origin, radius)`
returns a linear horizontal distance falloff in [0, 1]. This experimental field
ignores elevation, so the roof above home also shows maximum danger. R1 uses half
the horizontal world diagonal as radius and blends blue-to-red debug colours
into visible faces. These are diagnostic choices, not gameplay balancing rules.

At `/lab/r1-voxel`, compare Normal/Shadow for the meadow house or G1 examples,
and toggle the danger heatmap. The copied JSON includes all three choices.
