export const OBJECT_STYLE: string;
export const OBJECT_PIPELINE_VERSION: number;
export function prepareObjectSprite(source: Buffer, width: number, height: number, pixelSize?: number, palette?: readonly string[]): Promise<Buffer>;
export const OBJECT_STYLE_REFERENCE: string;
export function loadObjectStyleReference(publicDirectory: string): Promise<{ inlineData: { mimeType: string; data: string } }>;
