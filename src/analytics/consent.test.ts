import { describe, expect, it } from "vitest";

import {
  analyticsConsentVersion,
  parseConsent,
  serializeConsent,
} from "./consent";

describe("ölçümleme rızası", () => {
  it("aynı politika sürümündeki tercihi geri yükler", () => {
    expect(parseConsent(serializeConsent(false))).toMatchObject({
      analytics: false,
      version: analyticsConsentVersion,
    });
  });

  it("politika sürümü değiştiğinde yeniden karar ister", () => {
    const stale = JSON.stringify({ version: "0", analytics: true, decidedAt: "2026-01-01T00:00:00.000Z" });

    expect(parseConsent(stale)).toBeNull();
  });

  it("bozuk tarayıcı verisini rıza saymaz", () => {
    expect(parseConsent("not-json")).toBeNull();
  });
});
