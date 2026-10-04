import { describe, expect, it } from "vitest";
import { emptyMasks } from "../g3b-map/model";
import { approachingEdges, blendWeight, tileAt, tileOrigin, worldWalkable, worldOccluded, type WorldTile } from "./model";
import { parseChunkInput } from "./generation";
const masks = () => emptyMasks(128, 128);
describe("chunk world geometry", () => {
    it("uses floor coordinates for negative chunks and blocks absent corners", () => {
        expect(tileAt(-1, 20, 128, 128)).toBe("west");
        expect(tileAt(20, -1, 128, 128)).toBe("north");
        expect(tileAt(128, 20, 128, 128)).toBe("east");
        expect(tileAt(20, 128, 128, 128)).toBe("south");
        expect(tileAt(-1, -1, 128, 128)).toBeUndefined();
        expect(tileOrigin("west", 128, 128)).toEqual({ x: -128, y: 0 });
    });
    it("checks every foot pixel on both sides of a seam without blocking a loaded join", () => {
        const center = masks(), east = masks(), west = masks();
        const tiles: WorldTile[] = [{ masks: center }, { direction: "east", masks: east }, { direction: "west", masks: west }];
        expect(worldWalkable(tiles, 128, 128, 128, 64)).toBe(true);
        expect(worldWalkable(tiles, 128, 128, 0, 64)).toBe(true);
        east.collision[64 * 128 + 1] = 1;
        expect(worldWalkable(tiles, 128, 128, 128, 64)).toBe(false);
        expect(worldWalkable([{ masks: center }], 128, 128, 128, 64)).toBe(false);
        expect(worldWalkable(tiles, 128, 128, 64, 0)).toBe(false);
        expect(worldWalkable(tiles, 128, 128, NaN, 0)).toBe(false);
    });
    it("finds overhead in a neighbouring tile and starts prefetch before the boundary", () => {
        const north = masks();
        north.overhead[120 * 128 + 64] = 1;
        expect(worldOccluded([{ masks: masks() }, { direction: "north", masks: north }], 128, 128, 64, 8)).toBe(true);
        expect(approachingEdges(10, 64, 128, 128, 20)).toEqual(["west"]);
        expect(approachingEdges(-1, 64, 128, 128, 20)).toEqual([]);
        expect(approachingEdges(10, 10, 128, 128, 20)).toEqual(["north", "west"]);
    });
    it("blends smoothly to the new image without reversing the transition", () => {
        expect(blendWeight(0)).toBeLessThan(.01);
        expect(blendWeight(95)).toBeGreaterThan(.99);
        expect(blendWeight(48)).toBeGreaterThan(blendWeight(47));
    });
    it("bounds provider input and rejects arbitrary URLs and models", () => {
        expect(parseChunkInput({ image: "data:image/png;base64,YQ==", direction: "east" }).model).toBe("gemini-3.1-flash-lite-image");
        for (const patch of [{ image: "https://example.com/picture.png" }, { direction: "up" }, { model: "unknown" }, { maskModel: "unknown" }])
            expect(() => parseChunkInput({ image: "data:image/png;base64,YQ==", direction: "east", ...patch })).toThrow();
    });
});
