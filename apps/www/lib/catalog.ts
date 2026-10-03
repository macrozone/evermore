export type CatalogEntry = {
  id: string;
  name: string;
  description: string;
  href: string;
  category: "experiment" | "design" | "moodboard" | "vision";
  screenshot?: string;
  status: "ready" | "in-progress" | "planned";
};

/** Shared by /lab and the homepage overview. Only ready routes are linked. */
export const catalog: readonly CatalogEntry[] = [
  {
    id: "wish",
    screenshot: "/catalog/wish-desktop.png",
    name: "Wish · Inspiration estimate",
    description: "Estimate a wish before generation; compare scope, influence, inspiration and repeated model calls.",
    href: "/lab/wish",
    category: "experiment",
    status: "ready",
  },
  {
    id: "g3-map",
    name: "G3 · Image to layered tilemap",
    description: "Compare map images with colour-derived materials, uncertain layers and heuristic heights.",
    href: "/lab/g3-map",
    category: "experiment",
    status: "ready",
  },
  {
    id: "character",
    name: "Character A · Paper doll",
    description: "Describe a traveller, choose parts and colours, and inspect four directions of their walk cycle.",
    href: "/lab/character",
    category: "experiment",
    status: "ready",
  },
  {
    id: "image-to-voxel",
    name: "Image → voxel relief",
    description: "Compare image relief, ground anchors and cached Vision-LLM heights on cabin and harbour scenes.",
    href: "/lab/image-to-voxel",
    category: "experiment",
    screenshot: "/catalog/image-to-voxel.png",
    status: "ready",
  },
  {
    id: "objects",
    name: "G2 · AI object library",
    description: "Seven reusable village sprites with pixel, palette and collision-footprint previews.",
    href: "/lab/objects",
    category: "experiment",
    screenshot: "/catalog/g2-objects.png",
    status: "ready",
  },
  {
    id: "moodboards",
    screenshot: "/catalog/moodboards-desktop.png",
    name: "Art moodboards",
    description: "Explore every board, image and iteration of Evermore’s visual direction.",
    href: "/moodboards",
    category: "moodboard",
    status: "ready",
  },
  {
    id: "book",
    screenshot: "/catalog/book-desktop.png",
    name: "Book of Evermore",
    description: "Write your beginning in a book: two questions, page turns and adjustable typography.",
    href: "/lab/book",
    category: "experiment",
    status: "ready",
  },
  {
    id: "controls",
    name: "Controls & diagnostics",
    description: "Try the shared movement controls, frame counter and player coordinates.",
    href: "/lab/controls",
    category: "experiment",
    status: "ready",
  },
  {
    id: "r1-voxel",
    screenshot: "/catalog/r1-voxel-static.png",
    name: "R1 · Orthographic voxels",
    description: "Inspect the whole meadow-house world in Three.js with adjustable camera angles.",
    href: "/lab/r1-voxel",
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
    id: "g1-generator",
    name: "G1 · World generator",
    description: "Generate a forest village, harbour, desert ruins or monastery from a specification and seed.",
    href: "/lab/g1-generator",
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
  {
    id: "vision",
    name: "Product vision",
    description: "The living vision: wishes, connected worlds and the shadow world.",
    href: "/vision",
    category: "vision",
    status: "ready",
  },
];
