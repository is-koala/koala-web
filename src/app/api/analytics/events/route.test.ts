import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  logger: { info: vi.fn() },
}));

import * as Sentry from "@sentry/nextjs";
import { POST } from "./route";

describe("POST /api/analytics/events", () => {
  it("yalnız izinli, kişisel verisiz olay zarfını kabul eder", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const request = new Request("https://iskoala.com/api/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-koala-analytics-consent": "1" },
      body: JSON.stringify({ event: "app_opened", platform: "ios" }),
    });

    expect((await POST(request)).status).toBe(202);
    expect(Sentry.logger.info).toHaveBeenCalledWith("koala_handoff_metric", {
      event: "app_opened",
      platform: "ios",
    });
  });

  it("ek alan taşıyan olayları reddeder", async () => {
    const request = new Request("https://iskoala.com/api/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-koala-analytics-consent": "1" },
      body: JSON.stringify({ event: "app_opened", platform: "ios", token: "secret" }),
    });

    expect((await POST(request)).status).toBe(400);
  });

  it("izin listesi dışındaki olay ve platform etiketlerini reddeder", async () => {
    const request = new Request("https://iskoala.com/api/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-koala-analytics-consent": "1" },
      body: JSON.stringify({ event: "token_leaked", platform: "crawler" }),
    });

    expect((await POST(request)).status).toBe(400);
  });

  it("bildirilen büyük gövdeyi okumadan reddeder", async () => {
    const request = new Request("https://iskoala.com/api/analytics/events", {
      method: "POST",
      headers: {
        "content-length": "4096",
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.78",
        "x-koala-analytics-consent": "1",
      },
      body: "{}",
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "payload_too_large" });
  });

  it("chunked büyük gövdeyi sınırlı okuyup akışı iptal eder", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(200));
        controller.enqueue(new Uint8Array(100));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("https://iskoala.com/api/analytics/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.79",
        "x-koala-analytics-consent": "1",
      },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
  });

  it("aynı istemcinin yerel kotayı aşan olaylarını sınırlar", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const responses = [];

    for (let attempt = 0; attempt < 31; attempt += 1) {
      responses.push(await POST(new Request("https://iskoala.com/api/analytics/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.77",
          "x-koala-analytics-consent": "1",
        },
        body: JSON.stringify({ event: "handoff_viewed", platform: "desktop" }),
      })));
    }

    expect(responses.slice(0, 30).every((response) => response.status === 202)).toBe(true);
    expect(responses[30].status).toBe(429);
    expect(responses[30].headers.get("retry-after")).toBeTruthy();
  });
});
