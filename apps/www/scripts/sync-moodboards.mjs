import { cp, lstat, mkdir, rm } from "node:fs/promises";
import path from "node:path";

// Catladder ships apps/www, so include a generated snapshot for production.
// Local requests still use docs/art/moodboards directly.
const source = path.resolve("../../docs/art/moodboards");
const destination = path.resolve(".moodboards");
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, {
  recursive: true,
  filter: async (filename) => {
    const entry = await lstat(filename);
    return entry.isDirectory() || (entry.isFile() && /(?:README\.md|\.(?:jpe?g|png|webp|gif|avif))$/i.test(filename));
  },
});
