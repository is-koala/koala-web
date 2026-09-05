import * as Sentry from "@sentry/nextjs";

import { handoffEvents } from "@/analytics/events";
import { platforms } from "@/handoff/links";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (request.headers.get("x-koala-analytics-consent") !== "1") {
    return Response.json({ error: "consent_required" }, { status: 403 });
  }

  const rawBody = await request.text();
  if (rawBody.length > 256) {
    return Response.json({ error: "invalid_event" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_event" }, { status: 400 });
  }

  if (!isAnalyticsEvent(body)) {
    return Response.json({ error: "invalid_event" }, { status: 400 });
  }

  console.info(JSON.stringify({ type: "koala_handoff_metric", ...body }));
  Sentry.logger.info("koala_handoff_metric", body);
  return new Response(null, { status: 202 });
}

function isAnalyticsEvent(value: unknown): value is {
  event: (typeof handoffEvents)[number];
  platform: (typeof platforms)[number];
} {
  if (typeof value !== "object" || value === null) return false;
  if (Object.keys(value).sort().join(",") !== "event,platform") return false;
  const candidate = value as { event?: unknown; platform?: unknown };
  return handoffEvents.includes(candidate.event as (typeof handoffEvents)[number]) &&
    platforms.includes(candidate.platform as (typeof platforms)[number]);
}
