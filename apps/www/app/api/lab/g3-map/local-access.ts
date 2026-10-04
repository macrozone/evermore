import { NextResponse } from "next/server";
const noStore = { "Cache-Control": "no-store" };
export function deny(request: Request) {
  const url = new URL(request.url), host = request.headers.get("host") ?? url.host;
  let browser: URL;
  try { browser = new URL(`${url.protocol}//${host}`); } catch { return NextResponse.json({ error: "Invalid local host." }, { status: 403, headers: noStore }); }
  const local = (name: string) => ["localhost", "127.0.0.1", "[::1]"].includes(name);
  const origin = request.headers.get("origin"), forwarded = request.headers.get("x-forwarded-host"), site = request.headers.get("sec-fetch-site");
  if (process.env.NODE_ENV !== "development" || !local(url.hostname) || !local(browser.hostname) || browser.host !== host || browser.port !== url.port || browser.username !== "" || browser.password !== "" || request.headers.has("forwarded") || (forwarded !== null && forwarded !== host) || (origin !== null && origin !== browser.origin) || (request.method === "POST" && origin !== browser.origin) || (site !== null && !["same-origin", "none"].includes(site))) return NextResponse.json({ error: "Live maps require local development from the same loopback origin." }, { status: 403, headers: noStore });
}
