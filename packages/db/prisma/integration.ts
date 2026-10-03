import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createDb } from "@evermore/db";

assert.throws(() => createDb(""), /DATABASE_URL/);
const db = createDb();
try {
  execFileSync("pnpm", ["seed"], { stdio: "inherit" });
  const before = await db.player.findUniqueOrThrow({
    where: { id: "00000000-0000-4000-8000-000000000001" },
  });
  execFileSync("pnpm", ["seed"], { stdio: "inherit" });
  const after = await db.player.findUniqueOrThrow({ where: { id: before.id } });
  assert.deepEqual(after, before, "seeding twice must preserve the placeholder");
  const player = await db.player.create({ data: {} });
  try {
    assert.match(player.id, /^[0-9a-f-]{36}$/);
    assert.ok(player.createdAt instanceof Date);
    assert.deepEqual(await db.player.findUnique({ where: { id: player.id } }), player);
  } finally {
    await db.player.delete({ where: { id: player.id } });
  }
  console.log("Database integration passed: package import, seed idempotence, create/read/delete.");
} finally {
  await db.$disconnect();
}
