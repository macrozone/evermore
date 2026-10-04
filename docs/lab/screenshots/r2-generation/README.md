# R2 generation evidence

G1 specifications now feed the playable R2 layered tilemap. Select **G1 generated world**, choose one of four examples, edit the seed, then press **Generate world**. **New seed + generate** rerolls immediately. Book hash links and `evermore:lastSpec` open the imported world automatically.

- [G1 source](source-g1.png) and [source specification + seed](source.json)
- [The same forest specification and seed in R2](result-forest.png)
- [Harbour example](result-harbour.png)
- [Book-shaped hash import](result-book-import.png)
- [Mobile overlay](mobile.png)
- [Browser assertions and movement measurements](check.json)

Look at the shared terrain layout in G1 and R2, then focus the R2 world and walk with WASD/arrows. Try changing the draft seed before generating: the world stays in place until applied; generation resets the player to the generated spawn. Inspect buildings with cutaway and overhead layers.

Open questions: how should G1's semantic palette/daylight affect the tile art, and how should procedural buildings acquire the detail of the authored forest-cottage scene? This integration uses the existing procedural detail tiles; it does not claim moodboard-level generated art. G1's diagnostic map shows the whole world while R2 follows the player, so the screenshots use different framing.

Reproduce against a running local production server:

```sh
node scripts/check-r2-generation.mjs http://127.0.0.1:<port>
```

The headless check covers four examples, draft/apply behavior, keyboard movement, seed reroll, storage import, hash precedence, invalid links, mobile controls and runtime errors. No model call is needed.
