import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cookieStore, envelope, jsonResponse } from "../../../tests/support/session-cookies";

import { readAgreements } from "./agreements";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

describe("yürürlükteki sözleşmeler", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("zorunluluk bilgisini koruyarak sözleşmeleri okur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        200,
        envelope([
          {
            id: "a1",
            type: "TERMS_OF_SERVICE",
            version: "1.0",
            locale: "tr",
            contentUrl: null,
            mandatory: true,
            effectiveFrom: "2026-01-01T00:00:00Z",
          },
          {
            id: "a3",
            type: "COMMERCIAL_MESSAGE",
            version: "1.0",
            locale: "tr",
            contentUrl: "https://iskoala.com/ticari-ileti",
            mandatory: false,
            effectiveFrom: "2026-01-01T00:00:00Z",
          },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readAgreements()).resolves.toEqual([
      { id: "a1", type: "TERMS_OF_SERVICE", version: "1.0", mandatory: true, contentUrl: null },
      {
        id: "a3",
        type: "COMMERCIAL_MESSAGE",
        version: "1.0",
        mandatory: false,
        contentUrl: "https://iskoala.com/ticari-ileti",
      },
    ]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/legal/agreements");
    expect(init.method).toBe("GET");
  });

  it("gövde hiç gelmezse boş liste döndürür", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(null))));

    await expect(readAgreements()).resolves.toEqual([]);
  });
});
