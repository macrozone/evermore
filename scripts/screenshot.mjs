import { spawn, execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, parseEnv } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
let server;
let browser;
const stopServer = () => {
  if (!server?.pid) return;
  // pnpm and Next.js children share this process group; never stop a reused server.
  try { process.kill(-server.pid, "SIGTERM"); } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
};
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopServer();
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

try {
  const { values, positionals } = parseArgs({
    options: { wait: { type: "string", default: "1000" }, out: { type: "string" }, help: { type: "boolean" } },
    allowPositionals: true,
  });
  if (values.help) {
    console.log("Usage: pnpm screenshot /lab[/page] [--wait ms] [--out file.png]");
  } else {
    const route = positionals[0];
    if (positionals.length !== 1 || !/^\/lab(?:\/|\?|$)/.test(route ?? "") || route.includes("#")) {
      throw new Error("Provide one local /lab path, optionally with a query string.");
    }
    const wait = Number(values.wait);
    if (!/^\d+$/.test(values.wait) || !Number.isSafeInteger(wait) || wait > 120000) {
      throw new Error("--wait must be an integer between 0 and 120000 milliseconds.");
    }
    const output = path.resolve(root, values.out ?? `docs/lab/screenshots/${route.split("?")[0].replace(/^\//, "").replaceAll("/", "-")}-${Date.now()}.png`);
    if (path.extname(output).toLowerCase() !== ".png") throw new Error("--out must end in .png");

    execFileSync(process.execPath, ["--experimental-strip-types", "scripts/ensure-base-port.ts"], { cwd: root, stdio: "inherit" });
    const { BASE_PORT } = parseEnv(await readFile(path.join(root, ".env.local"), "utf8"));
    const origin = `http://127.0.0.1:${BASE_PORT}`;
    const url = new URL(route, origin);
    if (url.origin !== origin || !/^\/lab(?:\/|$)/.test(url.pathname)) throw new Error("Path must stay under /lab.");
    const responding = async () => {
      try {
        const response = await fetch(origin, { signal: AbortSignal.timeout(2000), redirect: "manual" });
        await response.body?.cancel();
        return true;
      } catch { return false; }
    };
    // Fail before starting a server if Chromium has not been installed.
    try { browser = await chromium.launch({ headless: true }); } catch (error) {
      throw new Error(`Cannot launch headless Chromium. Run pnpm exec playwright install chromium (Linux: add --with-deps).\n${error.message}`);
    }
    if (await responding()) {
      console.log(`[screenshot] Reusing ${origin}`);
    } else {
      console.log(`[screenshot] Starting apps/www at ${origin}`);
      server = spawn("pnpm", ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", BASE_PORT], {
        cwd: path.join(root, "apps/www"), env: { ...process.env, BASE_PORT }, detached: true, stdio: "inherit",
      });
      let spawnError;
      server.on("error", (error) => { spawnError = error; });
      const deadline = Date.now() + 120000;
      while (!(await responding())) {
        if (spawnError) throw spawnError;
        if (server.exitCode !== null || server.signalCode !== null) throw new Error("apps/www exited before it was ready.");
        if (Date.now() > deadline) throw new Error("apps/www did not respond within 120 seconds.");
        await delay(250);
      }
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const response = await page.goto(url.href, { waitUntil: "load", timeout: 120000 });
    if (!response?.ok()) throw new Error(`Page returned HTTP ${response?.status() ?? "unknown"}: ${url.href}`);
    await page.evaluate(() => document.fonts.ready);
    await delay(wait);
    await mkdir(path.dirname(output), { recursive: true });
    await page.screenshot({ path: output, type: "png", fullPage: true });
    console.log(`[screenshot] Saved ${output}`);
  }
} catch (error) {
  console.error(`[screenshot] ${error.message}`);
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } finally { stopServer(); }
}
