import dotenv from "dotenv";

// catenv can be invoked from a package directory. Its config loader does not
// support node builtins, so use relative candidates rather than fs/path here.
dotenv.config({
  path: [".env.local", "../.env.local", "../../.env.local", ".env", "../.env", "../../.env"],
  quiet: true,
});
export const LOCAL_BASE_PORT = Number(process.env.BASE_PORT ?? 3000);
if (!Number.isInteger(LOCAL_BASE_PORT) || LOCAL_BASE_PORT < 1024 || LOCAL_BASE_PORT > 65436) {
  throw new Error("Invalid BASE_PORT; run pnpm catenv from the repository root");
}
export const WWW_PORT = LOCAL_BASE_PORT;
export const DB_PORT = LOCAL_BASE_PORT + 30;
export const TASK_QUEUE_PORT = LOCAL_BASE_PORT + 31;
export const DEV_INDEX_PORT = LOCAL_BASE_PORT + 90;
export const COMPOSE_PROJECT_NAME = `evermore-${LOCAL_BASE_PORT}`;
