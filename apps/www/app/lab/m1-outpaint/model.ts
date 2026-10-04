import { type Masks, type MaskResult } from "../g3b-map/model";
export const OVERLAP = 96;
export const DIRECTIONS = ["north", "east", "south", "west"] as const;
export type Direction = typeof DIRECTIONS[number];
export type Seam = "pure" | "blend";
export const OFFSETS: Record<Direction, [
    number,
    number
]> = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
export type ChunkRecord = {
    version: 1;
    direction: Direction;
    width: number;
    height: number;
    overlap: number;
    image: string;
    context: string;
    masks: MaskResult;
    model: string;
    durationMs: number;
    estimatedCostUsd: number;
    imageCostUsd: number;
    maskCostUsd: number;
    generatedAt: string;
    outputWidth: number;
    outputHeight: number;
};
export type WorldTile = {
    direction?: Direction;
    masks: Masks;
};
export function tileOrigin(direction: Direction | undefined, width: number, height: number) {
    const [x, y] = direction !== undefined ? OFFSETS[direction] : [0, 0];
    return { x: x! * width, y: y! * height };
}
export function tileAt(x: number, y: number, width: number, height: number): Direction | "center" | undefined {
    const tx = Math.floor(x / width), ty = Math.floor(y / height);
    if (tx === 0 && ty === 0)
        return "center";
    return DIRECTIONS.find(d => OFFSETS[d][0] === tx && OFFSETS[d][1] === ty);
}
/** Sample the full feet footprint across chunk boundaries; missing chunks are solid. */
export function worldWalkable(tiles: WorldTile[], width: number, height: number, x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y))
        return false;
    for (let py = Math.floor(y - 2); py <= Math.ceil(y + 2); py++)
        for (let px = Math.floor(x - 4); px <= Math.ceil(x + 4); px++) {
            const location = tileAt(px, py, width, height);
            if (location === undefined)
                return false;
            const tile = tiles.find(t => location === "center" ? t.direction === undefined : t.direction === location);
            if (!tile)
                return false;
            const origin = tileOrigin(tile.direction, width, height), index = (py - origin.y) * width + px - origin.x;
            if (tile.masks.collision[index] !== 0)
                return false;
        }
    return true;
}
export function worldOccluded(tiles: WorldTile[], width: number, height: number, x: number, y: number) {
    for (let py = Math.floor(y - 22); py < y + 2; py++)
        for (let px = Math.floor(x - 5); px < x + 5; px++) {
            const location = tileAt(px, py, width, height);
            const tile = tiles.find(t => location === "center" ? t.direction === undefined : location !== undefined && t.direction === location);
            if (tile) {
                const origin = tileOrigin(tile.direction, width, height);
                if (tile.masks.overhead[(py - origin.y) * width + px - origin.x] === 1)
                    return true;
            }
        }
    return false;
}
export function approachingEdges(x: number, y: number, width: number, height: number, margin = 180): Direction[] {
    if (x < 0 || x >= width || y < 0 || y >= height)
        return [];
    return DIRECTIONS.filter(d => d === "north" ? y < margin : d === "south" ? y > height - margin : d === "west" ? x < margin : x > width - margin);
}
/** Weight increases toward the new chunk; pure mode never touches parent pixels. */
export function blendWeight(pixel: number, overlap = OVERLAP) { return Math.max(0, Math.min(1, (pixel + .5) / overlap)); }
