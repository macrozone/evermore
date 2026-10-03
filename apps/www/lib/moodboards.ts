import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const canonicalRoot = path.resolve(process.cwd(), "../../docs/art/moodboards");
// Production images contain a generated snapshot; local requests use live sources.
export const moodboardsRoot = existsSync(canonicalRoot) ? canonicalRoot : path.resolve(process.cwd(), ".moodboards");

const imageTypes: Record<string, string | undefined> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif",
};
const validSegment = (value: string) => value !== "." && value !== ".." && !/[\\/\0]/.test(value) && value.length > 0;

export type MoodboardImage = { filename: string; src: string; iteration: number };
export type Moodboard = {
  slug: string;
  title: string;
  description: string;
  markdown: string;
  iterations: { number: number; images: MoodboardImage[] }[];
};

export function imageContentType(filename: string) {
  return imageTypes[path.extname(filename).toLowerCase()];
}

export function imageUrl(board: string, filename: string) {
  return `/moodboards/${encodeURIComponent(board)}/images/${encodeURIComponent(filename)}`;
}

export function imageIteration(filename: string) {
  const match = /^it([1-9]\d*)-/.exec(filename);
  return match ? Number(match[1]) : 1;
}

function isMissing(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

/** A board is a real directory with a regular README; symlinks are never served. */
export async function readMoodboard(slug: string, root = moodboardsRoot): Promise<Moodboard | undefined> {
  if (!validSegment(slug)) return undefined;
  let entries;
  try {
    const directories = await readdir(root, { withFileTypes: true });
    if (!directories.some((entry) => entry.name === slug && entry.isDirectory())) return undefined;
    entries = await readdir(path.join(root, slug), { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
  if (!entries.some((entry) => entry.name === "README.md" && entry.isFile())) return undefined;
  const markdown = await readFile(path.join(root, slug, "README.md"), "utf8");
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ?? slug;
  const description = markdown.replace(/^#\s+.+\r?\n/, "").trim().split(/\r?\n\s*\r?\n/)[0] ?? "";
  const groups = new Map<number, MoodboardImage[]>();
  for (const entry of entries.filter((entry) => entry.isFile() && imageContentType(entry.name) !== undefined).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const iteration = imageIteration(entry.name);
    const images = groups.get(iteration) ?? [];
    images.push({ filename: entry.name, src: imageUrl(slug, entry.name), iteration });
    groups.set(iteration, images);
  }
  return {
    slug, title, description, markdown,
    iterations: [...groups].sort(([a], [b]) => b - a).map(([number, images]) => ({ number, images })),
  };
}

export async function readMoodboards(root = moodboardsRoot): Promise<Moodboard[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const boards = await Promise.all(entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name, "en")).map((entry) => readMoodboard(entry.name, root)));
  return boards.filter((board): board is Moodboard => board !== undefined);
}

export async function readMoodboardImage(board: string, filename: string, root = moodboardsRoot) {
  if (!validSegment(filename) || imageContentType(filename) === undefined) return undefined;
  const data = await readMoodboard(board, root);
  if (!data?.iterations.some((iteration) => iteration.images.some((image) => image.filename === filename))) return undefined;
  try {
    return await readFile(path.join(root, board, filename));
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

/** Preserve external links and route canonical relative board/image links locally. */
export function moodboardLink(slug: string, href: string | undefined) {
  if (href === undefined || href === "" || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) return href;
  const [pathname, suffix = ""] = href.split(/(?=[?#])/s, 2);
  const target = path.posix.normalize(path.posix.join(slug, pathname!));
  const parts = target.split("/");
  if (parts.length === 2 && validSegment(parts[0]!) && parts[1] === "README.md") return `/moodboards/${encodeURIComponent(parts[0]!)}${suffix}`;
  if (parts.length === 2 && validSegment(parts[0]!) && imageContentType(parts[1]!) !== undefined) return `${imageUrl(parts[0]!, parts[1]!)}${suffix}`;
  if (target === "README.md") return `/moodboards${suffix}`;
  const repoPath = path.posix.normalize(`docs/art/moodboards/${target}`);
  return `https://github.com/macrozone/evermore/blob/main/${repoPath}${suffix}`;
}
