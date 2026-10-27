import type { NextRequest } from "next/server";

// Server-side proxy to the private Hugging Face Space. The token stays on the server: the
// browser only talks to /api/backend/*, and only the routes below are forwarded.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED: ReadonlyArray<readonly [string, RegExp]> = [
  ["POST", /^jobs$/],
  ["GET", /^jobs\/[\w-]{16,64}$/],
  ["DELETE", /^jobs\/[\w-]{16,64}$/],
  ["GET", /^ready$/],
];
const MAX_BODY_BYTES = 64 * 1024;
const UPSTREAM_TIMEOUT_MS = 25_000;

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const path = (await ctx.params).path.join("/");
  if (!ALLOWED.some(([method, pattern]) => method === req.method && pattern.test(path))) {
    return json({ error: "not_found" }, 404);
  }
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return json({ error: "forbidden" }, 403);
  }

  const baseUrl = process.env.STABILIS_API_URL;
  const token = process.env.HF_SPACE_TOKEN;
  if (!baseUrl || !token) {
    console.error("backend proxy: STABILIS_API_URL or HF_SPACE_TOKEN is not configured");
    return json({ error: "backend_unavailable" }, 502);
  }

  let body: string | undefined;
  if (req.method === "POST") {
    body = await req.text();
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/+$/, "")}/${path}`, {
      method: req.method,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    });
  } catch {
    // Timeouts and connection errors usually mean the Space is waking up.
    return json({ error: "backend_starting" }, 503, { "retry-after": "15" });
  }

  const isJson = (upstream.headers.get("content-type") ?? "").includes("application/json");
  if (!isJson && upstream.status !== 204) {
    if ([502, 503, 504].includes(upstream.status)) {
      return json({ error: "backend_starting" }, 503, { "retry-after": "15" });
    }
    // The Hugging Face gateway answers 401/404 pages when the token or URL is wrong.
    console.error(`backend proxy: unexpected non-JSON response (HTTP ${upstream.status}) from upstream`);
    return json({ error: "backend_unavailable" }, 502);
  }

  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (upstream.status !== 204) headers["content-type"] = "application/json";
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) headers["retry-after"] = retryAfter;
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers });
}

export { handle as DELETE, handle as GET, handle as POST };
