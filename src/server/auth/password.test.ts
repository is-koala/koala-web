import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { cookieStore, envelope, jsonResponse } from "../../../tests/support/session-cookies";

import { requestPasswordReset, resetPassword } from "./password";

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

describe("parola sıfırlama", () => {
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

  it("sıfırlama e-postasını yalnız adresle ister", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await requestPasswordReset("ada@example.test");

    expect(requestOf(fetchMock)).toEqual({
      url: "https://api.example.test/auth/forgot-password",
      body: { email: "ada@example.test" },
    });
  });

  it("yeni parolayı sıfırlama tokenıyla birlikte gönderir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await resetPassword({ resetToken: "reset-placeholder", newPassword: "Koala2026" });

    expect(requestOf(fetchMock)).toEqual({
      url: "https://api.example.test/auth/reset-password",
      body: { resetToken: "reset-placeholder", newPassword: "Koala2026" },
    });
  });

  it("tüketilmiş tokenı kodu bozmadan yükseltir", async () => {
    // `PasswordResetTokenManager.consume` tokenı tek kullanımlık tutuyor;
    // ikinci gönderim 400 AUTH_PASSWORD_RESET_TOKEN_INVALID döner.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          success: false,
          errorCode: "AUTH_PASSWORD_RESET_TOKEN_INVALID",
          errorCategory: "VALIDATION_FAILED",
          message: "Token gecersiz.",
        }),
      ),
    );

    const error = await resetPassword({
      resetToken: "reset-placeholder",
      newPassword: "Koala2026",
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).errorCode).toBe("AUTH_PASSWORD_RESET_TOKEN_INVALID");
  });
});
