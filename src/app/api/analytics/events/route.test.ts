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
});
