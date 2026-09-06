import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import { readWorkerPayouts } from "./payouts";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

describe("işçi ödeme çıkışları BFF sözleşmesi", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    requestHeaders.delete("x-real-ip");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sunucunun sıralı listesini finansal alanları değiştirmeden taşır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope([
        {
          id: "a1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
          jobAssignmentId: "b1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
          amount: "1000.10",
          currency: "TRY",
          status: "FAILED",
          failureReason: "IBAN sahibi eşleşmedi",
          completedAt: null,
          createdAt: "2026-09-05T10:30:00Z",
        },
        {
          id: "c1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
          jobAssignmentId: "d1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
          amount: 250,
          currency: "TRY",
          status: "PROVIDER_PENDING",
          failureReason: " ",
          completedAt: null,
          createdAt: "2026-09-04T08:00:00Z",
        },
      ])),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readWorkerPayouts()).resolves.toEqual([
      {
        id: "a1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        assignmentId: "b1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        amount: "1000.10",
        currency: "TRY",
        status: "FAILED",
        failureReason: "IBAN sahibi eşleşmedi",
        completedAt: null,
        createdAt: "2026-09-05T10:30:00Z",
      },
      {
        id: "c1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        assignmentId: "d1f0d24c-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        amount: "250",
        currency: "TRY",
        status: "UNKNOWN",
        failureReason: null,
        completedAt: null,
        createdAt: "2026-09-04T08:00:00Z",
      },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.test/users/me/payouts");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it("boş backend verisini boş listeye çevirir", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(null))));

    await expect(readWorkerPayouts()).resolves.toEqual([]);
  });
});
