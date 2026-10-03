export const BODY_PARTS = ["compact", "balanced", "tall"] as const;
export const HAIR_PARTS = ["short", "long", "bald"] as const;
export const OUTFIT_PARTS = ["tunic", "coat", "robe"] as const;
export const ACCESSORY_PARTS = ["none", "satchel", "scarf", "hat"] as const;
export const COLOR_KEYS = ["skin", "hair", "clothing", "accent", "boots"] as const;
export const CHARACTER_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.1-pro-preview"] as const;
export type CharacterModel = typeof CHARACTER_MODELS[number];
export interface CharacterSpecification {
  version: 1;
  name: string;
  body: typeof BODY_PARTS[number];
  hair: typeof HAIR_PARTS[number];
  outfit: typeof OUTFIT_PARTS[number];
  accessory: typeof ACCESSORY_PARTS[number];
  colors: Record<typeof COLOR_KEYS[number], string>;
}
export interface CharacterInput { description: string; model: CharacterModel }
export interface CharacterGeneration {
  specification: CharacterSpecification;
  source: "vertex" | "example";
  model: CharacterModel;
  fallbackReason?: "disabled" | "credentials" | "provider" | "invalid-output";
  durationMs: number;
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Expected an object.");
  return value as Record<string, unknown>;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (!choices.includes(value as T)) throw new TypeError("Unknown character part.");
  return value as T;
}
export function parseCharacterSpecification(value: unknown): CharacterSpecification {
  const spec = object(value);
  if (spec.version !== 1 || typeof spec.name !== "string" || spec.name.trim().length === 0 || spec.name.length > 80) throw new TypeError("Invalid character identity.");
  const keys = ["version", "name", "body", "hair", "outfit", "accessory", "colors"];
  if (Object.keys(spec).some(key => !keys.includes(key))) throw new TypeError("Unexpected character property.");
  const colors = object(spec.colors);
  if (Object.keys(colors).length !== COLOR_KEYS.length || COLOR_KEYS.some(key => typeof colors[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(colors[key] as string))) throw new TypeError("Use five six-digit hex colors.");
  return {
    version: 1, name: spec.name.trim(),
    body: choice(spec.body, BODY_PARTS), hair: choice(spec.hair, HAIR_PARTS),
    outfit: choice(spec.outfit, OUTFIT_PARTS), accessory: choice(spec.accessory, ACCESSORY_PARTS),
    colors: Object.fromEntries(COLOR_KEYS.map(key => [key, (colors[key] as string).toLowerCase()])) as CharacterSpecification["colors"],
  };
}
export function parseCharacterInput(value: unknown): CharacterInput {
  const input = object(value);
  if (typeof input.description !== "string" || input.description.trim().length === 0 || input.description.length > 2000) throw new TypeError("Describe your character in 1–2000 characters.");
  return { description: input.description.trim(), model: choice(input.model ?? CHARACTER_MODELS[0], CHARACTER_MODELS) };
}

export const CHARACTER_EXAMPLES: readonly { description: string; specification: CharacterSpecification }[] = [
  { description: "A woodland botanist with copper hair, a green coat and a satchel full of seeds.", specification: {
    version: 1, name: "Woodland botanist", body: "balanced", hair: "short", outfit: "coat", accessory: "satchel",
    colors: { skin: "#dfa977", hair: "#a95832", clothing: "#467958", accent: "#e9ba67", boots: "#56453b" },
  } },
  { description: "A tall silver-haired mage in a violet robe and a golden scarf.", specification: {
    version: 1, name: "Twilight mage", body: "tall", hair: "long", outfit: "robe", accessory: "scarf",
    colors: { skin: "#bd8768", hair: "#d3d0ca", clothing: "#79598c", accent: "#e9c36e", boots: "#434356" },
  } },
  { description: "A compact bald sailor with a blue tunic and a red hat.", specification: {
    version: 1, name: "Harbour wanderer", body: "compact", hair: "bald", outfit: "tunic", accessory: "hat",
    colors: { skin: "#87563e", hair: "#302b31", clothing: "#597e99", accent: "#c96852", boots: "#4e3e35" },
  } },
];
/** Offline examples are deliberately finite; they are not a simulated model response. */
export function exampleForDescription(description: string): CharacterSpecification {
  const index = /mage|wizard|witch|magic|robe/i.test(description) ? 1 : /sailor|sea|harbou?r|pirate|hat/i.test(description) ? 2 : 0;
  return structuredClone(CHARACTER_EXAMPLES[index]!.specification);
}
const enumSchema = (values: readonly string[]) => ({ type: "string", enum: values });
export const CHARACTER_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["version", "name", "body", "hair", "outfit", "accessory", "colors"],
  properties: {
    version: { type: "integer", enum: [1] }, name: { type: "string", minLength: 1, maxLength: 80 },
    body: enumSchema(BODY_PARTS), hair: enumSchema(HAIR_PARTS), outfit: enumSchema(OUTFIT_PARTS), accessory: enumSchema(ACCESSORY_PARTS),
    colors: { type: "object", additionalProperties: false, required: COLOR_KEYS,
      properties: Object.fromEntries(COLOR_KEYS.map(key => [key, { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }])) },
  },
};
