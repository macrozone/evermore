/**
 * The 16-color palette of Evermore, based on "Sweetie 16" by GrafxKid
 * (https://lospec.com/palette-list/sweetie-16).
 *
 * The same colors are registered as Tailwind tokens in app/globals.css
 * (`bg-ember`, `text-snow`, …); Tailwind's default colors are disabled
 * there so only these 16 can be used. Keep both lists in sync – a test
 * checks it.
 */
export const palette = [
  { name: "night", hex: "#1a1c2c" },
  { name: "plum", hex: "#5d275d" },
  { name: "crimson", hex: "#b13e53" },
  { name: "ember", hex: "#ef7d57" },
  { name: "gold", hex: "#ffcd75" },
  { name: "lime", hex: "#a7f070" },
  { name: "grass", hex: "#38b764" },
  { name: "teal", hex: "#257179" },
  { name: "navy", hex: "#29366f" },
  { name: "royal", hex: "#3b5dc9" },
  { name: "sky", hex: "#41a6f6" },
  { name: "ice", hex: "#73eff7" },
  { name: "snow", hex: "#f4f4f4" },
  { name: "mist", hex: "#94b0c2" },
  { name: "slate", hex: "#566c86" },
  { name: "dusk", hex: "#333c57" },
] as const;

export type PaletteColor = (typeof palette)[number]["name"];
