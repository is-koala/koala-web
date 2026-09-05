import * as Sentry from "@sentry/nextjs";

import { handoffEvents } from "@/analytics/events";
import { takeAnalyticsQuota } from "@/analytics/rate-limit";
import { platforms } from "@/handoff/links";

export const dynamic = "force-dynamic";

const maxAnalyticsBodyBytes = 256;

export async function POST(request: Request) {
  if (request.headers.get("x-koala-analytics-consent") !== "1") {
    return Response.json({ error: "consent_required" }, { status: 403 });
  }

  const quota = takeAnalyticsQuota(request);
  if (!quota.allowed) {
    return Response.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(quota.retryAfterSeconds) },
      },
    );
  }

  const payload = await readBoundedText(request, maxAnalyticsBodyBytes);
  if (payload.tooLarge) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(payload.text);
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

async function readBoundedText(
  request: Request,
  maxBytes: number,
): Promise<{ tooLarge: true } | { tooLarge: false; text: string }> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    return { tooLarge: true };
  }

  if (!request.body) return { tooLarge: false, text: "" };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        text += decoder.decode();
        return { tooLarge: false, text };
      }

      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel("analytics payload too large");
        return { tooLarge: true };
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
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
