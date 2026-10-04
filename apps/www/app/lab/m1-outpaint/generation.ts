import { MAP_MODELS, VISION_MODELS } from "../g3b-map/generation";
import { DIRECTIONS, type Direction } from "./model";
export { MAP_MODELS, VISION_MODELS };
export type ChunkInput = {
    image: string;
    direction: Direction;
    model: string;
    maskModel: string;
};
export function parseChunkInput(value: unknown): ChunkInput {
    if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value))
        throw new TypeError("Provide chunk settings.");
    const v = value as Record<string, unknown>;
    if (!DIRECTIONS.includes(v.direction as Direction))
        throw new TypeError("Choose north, east, south or west.");
    const model = v.model ?? MAP_MODELS[0].id, maskModel = v.maskModel ?? VISION_MODELS[0].id;
    if (!MAP_MODELS.some(m => m.id === model) || !VISION_MODELS.some(m => m.id === maskModel))
        throw new TypeError("Choose supported image and mask models.");
    if (typeof v.image !== "string" || v.image.length > 8000000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v.image))
        throw new TypeError("Provide a bounded source image.");
    return { image: v.image, direction: v.direction as Direction, model: model as string, maskModel: maskModel as string };
}
export function chunkInstruction(direction: Direction, width: number, height: number, overlap: number) {
    const horizontal=direction==="east"||direction==="west";
    const percent=(overlap/(horizontal?width:height)*100).toFixed(2);
    const placement = { east: "left", west: "right", north: "bottom", south: "top" }[direction];
    return `Edit this padded outpainting canvas. Its ${placement} ${overlap}-pixel strip is existing terrain at the ${direction} edge of the existing world; KEEP it exactly registered, at the same coordinates. The strip occupies exactly ${percent}% of the canvas ${horizontal?"width":"height"}; it must NOT expand into a separate reference panel. This is ONE continuous map, never a collage or side-by-side comparison. Fill ALL grey blank space with the world continuing ${direction}. The canvas is ${width} by ${height} pixels. Continue every path and river touching the context strip at the exact same position, width and direction across the join. Extend their course naturally into the new land, with bridges if needed. Match the strip's orthogonal top-down camera, evening lighting, palette, tree size and crisp 16-bit pixel cluster scale. Do not shrink, zoom, duplicate the cabin, mirror, rotate or reframe the strip. No text, border, perspective or grey unfilled space. Return ONLY the edited canvas, including its existing strip.`;
}
export function chunkReservation(input: ChunkInput) {
    const image = MAP_MODELS.find(m => m.id === input.model)!, mask = VISION_MODELS.find(m => m.id === input.maskModel)!;
    return (10000 * image.inputPerMillion + 4096 * image.imagePerMillion + 5000 * mask.inputPerMillion + 16384 * mask.outputPerMillion) / 1e6;
}
