import type { NextRequest } from "next/server";
import { METRIC_EVENTS } from "@/app/lib/metricEvents";

// Anonymous counts (POLICY §19). Accepts only an event name from the closed list and adds one to a
// monthly counter. Nothing about the request (address, browser, time) is stored. Without the
// counter store configured, the request is accepted and dropped.
//
//   METRICS_UPSTASH_URL / METRICS_UPSTASH_TOKEN   Upstash Redis REST endpoint and token (free tier)

export const dynamic = "force-dynamic";

const EVENTS = new Set<string>(METRIC_EVENTS);
const MAX_BODY = 200;

export async function POST(req: NextRequest) {
  if (req.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403 });
  const text = await req.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let event: unknown;
  try {
    event = (JSON.parse(text) as { event?: unknown }).event;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof event !== "string" || !EVENTS.has(event)) return new Response(null, { status: 400 });

  const url = process.env.METRICS_UPSTASH_URL;
  const token = process.env.METRICS_UPSTASH_TOKEN;
  if (url && token) {
    const key = `stabilis:${new Date().toISOString().slice(0, 7)}:${event}`;
    await fetch(`${url.replace(/\/$/, "")}/incr/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
