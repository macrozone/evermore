import { createDb } from "@evermore/db";

const db = createDb();
try {
  // A stable, anonymous placeholder makes repeated setup safe.
  await db.player.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    create: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
  });
} finally {
  await db.$disconnect();
}
