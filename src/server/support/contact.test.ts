import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { cookieStore, envelope, jsonResponse } from "../../../tests/support/session-cookies";

import { postSupportContact } from "./contact";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

function requestOf(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, body: JSON.parse(init.body as string) as Record<string, unknown> };
}

describe("destek formu backend çağrısı", () => {
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

  it("SMTP olmadan POST /public/contact çağırır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await postSupportContact({
      topic: "kvkk",
      name: "Ada Yılmaz",
      email: "ada@example.test",
      message: "Verilerimin silinmesini istiyorum.",
      consent: true,
    });

    expect(requestOf(fetchMock)).toEqual({
      url: "https://api.example.test/public/contact",
      body: {
        topic: "kvkk",
        name: "Ada Yılmaz",
        email: "ada@example.test",
        message: "Verilerimin silinmesini istiyorum.",
        consent: true,
      },
    });
  });

  it("kuyruk hatasını kodu bozmadan yükseltir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(502, {
          success: false,
          errorCode: "EMAIL_SEND_FAILED",
          errorCategory: "UPSTREAM_FAILED",
          message: "E-posta gönderilemedi.",
        }),
      ),
    );

    const error = await postSupportContact({
      topic: "destek",
      name: "Ada Yılmaz",
      email: "ada@example.test",
      message: "Merhaba",
      consent: true,
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).errorCode).toBe("EMAIL_SEND_FAILED");
    expect((error as ApiError).status).toBe(502);
  });
});
