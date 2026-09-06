import type { Platform } from "@/handoff/links";
import { readConsent } from "./consent";

export const handoffEvents = [
  "handoff_viewed",
  "deep_link_attempted",
  "app_opened",
  "store_fallback",
  "desktop_fallback",
] as const;

export type HandoffEvent = (typeof handoffEvents)[number];

export function sendHandoffEvent(event: HandoffEvent, platform: Platform): void {
  if (!readConsent()?.analytics) return;

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-koala-analytics-consent": "1",
    },
    body: JSON.stringify({ event, platform }),
    keepalive: true,
  }).catch(() => undefined);
}
