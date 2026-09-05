import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { scrubSentryEvent, scrubSentryLog } from "./sentry";

describe("Sentry PII filtresi", () => {
  it("istek, kullanıcı ve serbest metni göndermeden hata tipini korur", () => {
    const event = {
      message: "ayse@example.com için token=secret",
      request: {
        url: "https://iskoala.com/hesap-dogrula?token=secret",
        headers: { authorization: "Bearer secret" },
        cookies: { session: "secret" },
        data: { phone: "+905551112233" },
      },
      user: { email: "ayse@example.com", ip_address: "127.0.0.1" },
      extra: { address: "Örnek Sokak 1" },
      breadcrumbs: [{ message: "CV: ayse.pdf", data: { latitude: 41.0 } }],
      exception: { values: [{ type: "TypeError", value: "ayse@example.com kırıldı" }] },
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.exception?.values?.[0]?.type).toBe("TypeError");
    expect(scrubbed.exception?.values?.[0]?.value).toBe("Hata ayrıntısı filtrelendi");
    expect(scrubbed.request).toMatchObject({ url: "https://iskoala.com/hesap-dogrula" });
    expect(scrubbed.request?.headers).toBeUndefined();
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.message).toBeUndefined();
    expect(scrubbed.breadcrumbs?.[0]?.message).toBeUndefined();
    expect(JSON.stringify(scrubbed)).not.toContain("secret");
    expect(JSON.stringify(scrubbed)).not.toContain("ayse@example.com");
  });
});

describe("Sentry ölçüm logu filtresi", () => {
  it("yalnız olay ve platform boyutlarını korur", () => {
    expect(
      scrubSentryLog({
        level: "info",
        message: "koala_handoff_metric",
        attributes: {
          event: "app_opened",
          platform: "ios",
          token: "secret",
          url: "https://iskoala.com/hesap-dogrula?token=secret",
        },
      }),
    ).toEqual({
      level: "info",
      message: "koala_handoff_metric",
      attributes: { event: "app_opened", platform: "ios" },
    });
  });

  it("tanımsız uygulama loglarını Sentry'ye göndermez", () => {
    expect(
      scrubSentryLog({
        level: "info",
        message: "user login",
        attributes: { email: "ayse@example.com" },
      }),
    ).toBeNull();
  });
});
