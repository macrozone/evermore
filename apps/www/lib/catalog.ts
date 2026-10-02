export type CatalogEntry = {
  id: string;
  name: string;
  description: string;
  href: string;
  category: "experiment" | "design" | "moodboard";
  status: "ready" | "in-progress" | "planned";
};

/** Shared by /lab and the future homepage overview. Only ready routes are linked. */
export const catalog: readonly CatalogEntry[] = [
  {
    id: "controls",
    name: "Controls & diagnostics",
    description: "Try the shared movement controls, frame counter and player coordinates.",
    href: "/lab/controls",
    category: "experiment",
    status: "ready",
  },
  {
    id: "r2-tilemap",
    name: "R2 · Layered tilemap",
    description: "Explore the meadow, house, bridge and tower in a PixiJS 3/4 tilemap.",
    href: "/lab/r2-tilemap",
    category: "experiment",
    status: "ready",
  },
  {
    id: "design",
    name: "Design foundations",
    description: "Typography, palette and the first UI building blocks.",
    href: "/design",
    category: "design",
    status: "ready",
  },
];
