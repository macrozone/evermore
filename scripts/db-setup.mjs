import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
function run(args, env = process.env) {
  execFileSync("pnpm", args, { cwd: root, env, stdio: "inherit" });
}

// Generate the worktree's stable ports and Compose project before starting DB.
run(["catenv"]);
const local = parseEnv(readFileSync(new URL("../apps/local-development/.env", import.meta.url), "utf8"));
if (local.DB_PORT === undefined || !/^\d+$/.test(local.DB_PORT) || local.COMPOSE_PROJECT_NAME === undefined) {
  throw new Error("Generated local-development env must contain DB_PORT and COMPOSE_PROJECT_NAME");
}
const env = {
  ...process.env,
  ...local,
  // Setup always targets this worktree's local DB, even with a production URL in the shell.
  DATABASE_URL: `postgresql://evermore:evermore@localhost:${local.DB_PORT}/evermore`,
};
run(["--filter", "@evermore/local-development", "services:up"], env);
run(["--filter", "@evermore/db", "build"], env);
run(["--filter", "@evermore/db", "migrate"], env);
run(["--filter", "@evermore/db", "seed"], env);
run(["--filter", "@evermore/db", "test:integration"], env);
