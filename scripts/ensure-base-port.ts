import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { parseEnv } from "node:util";

const FIRST_PORT = 4000;
const SLOT_SIZE = 100;
const SLOT_COUNT = 60;
const root = fs.realpathSync(process.cwd());
const readEnv = (dir: string, name: string) => {
  const file = path.join(dir, name);
  return fs.existsSync(file) ? parseEnv(fs.readFileSync(file, "utf8")) : {};
};
const validate = (value: string) => {
  const port = Number(value);
  if (!/^\d+$/.test(value) || port < 1024 || port + 99 > 65535) {
    throw new Error("BASE_PORT must be an integer between 1024 and 65436");
  }
  return port;
};
const hash = (value: string) => {
  let result = 5381;
  for (const char of value) result = ((result * 33) ^ char.charCodeAt(0)) >>> 0;
  return result;
};
const portFree = (port: number) => new Promise<boolean>((resolve, reject) => {
  const server = net.createServer();
  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" || error.code === "EACCES") resolve(false);
    else reject(error);
  });
  server.listen(port, () => server.close(() => resolve(true)));
});

// A persisted slot remains stable even while its services are listening.
const existing = process.env.BASE_PORT ?? readEnv(root, ".env.local").BASE_PORT ?? readEnv(root, ".env").BASE_PORT;
let basePort: number;
if (existing !== undefined) {
  basePort = validate(existing);
} else if (fs.statSync(path.join(root, ".git")).isDirectory()) {
  basePort = 3000;
} else {
  // Reserve slots of stopped sibling worktrees too, not just listening ports.
  const worktrees = execFileSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf8" })
    .split("\n").filter((line) => line.startsWith("worktree ")).map((line) => line.slice(9));
  const reserved = worktrees.filter((dir) => dir !== root).map((dir) => {
    const value = readEnv(dir, ".env.local").BASE_PORT ?? readEnv(dir, ".env").BASE_PORT;
    return value === undefined ? 3000 : validate(value);
  });
  const start = hash(root) % SLOT_COUNT;
  let selected: number | undefined;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const candidate = FIRST_PORT + ((start + i) % SLOT_COUNT) * SLOT_SIZE;
    if (reserved.some((port) => candidate <= port + 99 && candidate + 99 >= port)) continue;
    const free = await Promise.all(Array.from({ length: SLOT_SIZE }, (_, offset) => portFree(candidate + offset)));
    if (free.every(Boolean)) { selected = candidate; break; }
  }
  if (selected === undefined) throw new Error("No free worktree port slot (4000–9999)");
  basePort = selected;
}

const file = path.join(root, ".env.local");
const contents = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const withoutBase = contents.replace(/^\s*(?:export\s+)?BASE_PORT\s*=.*(?:\r?\n|$)/gm, "").trimEnd();
fs.writeFileSync(file, `${withoutBase ? withoutBase + "\n" : ""}BASE_PORT=${basePort}\n`);
console.log(`[ensure-base-port] BASE_PORT=${basePort} (${root})`);
