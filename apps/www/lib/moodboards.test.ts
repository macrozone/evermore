import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { imageIteration, moodboardLink, readMoodboard, readMoodboardImage, readMoodboards } from "./moodboards";

const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "evermore-moodboards-"));
  roots.push(root);
  await mkdir(path.join(root, "02-world"));
  await writeFile(path.join(root, "02-world/README.md"), "# Own world\n\nA **cozy** home.\n\n## Notes\nMore detail.");
  for (const name of ["cottage.jpg", "it2-cottage.png", "it10-cottage.webp", "notes.txt"]) {
    await writeFile(path.join(root, "02-world", name), name);
  }
  await writeFile(path.join(root, "README.md"), "# Board index");
  await mkdir(path.join(root, "not-a-board"));
  return root;
}
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("canonical moodboards", () => {
  it("discovers only boards with a README, extracts metadata and orders iterations numerically newest first", async () => {
    const boards = await readMoodboards(await fixture());
    expect(boards).toHaveLength(1);
    expect(boards[0]).toMatchObject({ slug: "02-world", title: "Own world", description: "A **cozy** home." });
    expect(boards[0]!.iterations.map((iteration) => iteration.number)).toEqual([10, 2, 1]);
    expect(boards[0]!.iterations.flatMap((iteration) => iteration.images)).toHaveLength(3);
    expect(boards[0]!.iterations[0]!.images[0]!.src).toBe("/moodboards/02-world/images/it10-cottage.webp");
  });

  it("picks up added images and new boards without registry or code changes", async () => {
    const root = await fixture();
    await readMoodboards(root);
    await writeFile(path.join(root, "02-world/it3-new.JPG"), "new image");
    await mkdir(path.join(root, "01-book"));
    await writeFile(path.join(root, "01-book/README.md"), "# Book\n\nA living book.");
    const boards = await readMoodboards(root);
    expect(boards.map((board) => board.slug)).toEqual(["01-book", "02-world"]);
    expect(boards[1]!.iterations.map((iteration) => iteration.number)).toEqual([10, 3, 2, 1]);
    expect(await readMoodboardImage("02-world", "it3-new.JPG", root)).toEqual(Buffer.from("new image"));
  });

  it("handles empty boards, unknown boards and missing roots", async () => {
    const root = await fixture();
    expect(await readMoodboard("not-a-board", root)).toBeUndefined();
    expect(await readMoodboard("missing", root)).toBeUndefined();
    expect(await readMoodboards(path.join(root, "absent"))).toEqual([]);
    await mkdir(path.join(root, "empty"));
    await writeFile(path.join(root, "empty/README.md"), "# Empty");
    expect((await readMoodboard("empty", root))?.iterations).toEqual([]);
  });

  it("rejects path traversal, non-image files, nested paths and symlinks", async () => {
    const root = await fixture();
    await symlink(path.join(root, "02-world"), path.join(root, "linked-board"));
    await symlink(path.join(root, "README.md"), path.join(root, "02-world/leak.jpg"));
    await mkdir(path.join(root, "linked-readme"));
    await symlink(path.join(root, "README.md"), path.join(root, "linked-readme/README.md"));
    expect(await readMoodboards(root)).toHaveLength(1);
    for (const board of ["..", "../02-world", "02-world/..", "linked-board"]) {
      expect(await readMoodboard(board, root)).toBeUndefined();
    }
    for (const file of ["README.md", "../cottage.jpg", "nested/cottage.jpg", "leak.jpg", "missing.png"]) {
      expect(await readMoodboardImage("02-world", file, root)).toBeUndefined();
    }
  });

  it("recognizes numbered iteration prefixes and leaves other names in iteration one", () => {
    expect(imageIteration("it12-scene.jpg")).toBe(12);
    expect(imageIteration("inventar-v2.jpg")).toBe(1);
    expect(imageIteration("it0-scene.jpg")).toBe(1);
  });

  it("routes README and image links locally while preserving external links and anchors", () => {
    expect(moodboardLink("02-world", "../04-shadow/README.md#notes")).toBe("/moodboards/04-shadow#notes");
    expect(moodboardLink("02-world", "it2-cottage.png")).toBe("/moodboards/02-world/images/it2-cottage.png");
    expect(moodboardLink("02-world", "../README.md")).toBe("/moodboards");
    expect(moodboardLink("02-world", "../../README.md")).toBe("https://github.com/macrozone/evermore/blob/main/docs/art/README.md");
    expect(moodboardLink("02-world", "#notes")).toBe("#notes");
    expect(moodboardLink("02-world", "https://example.com")).toBe("https://example.com");
  });
});
