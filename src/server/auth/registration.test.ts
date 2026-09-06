import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { cookieStore, envelope, jsonResponse } from "../../../tests/support/session-cookies";

import { completeRegistration, startRegistration, verifyRegistrationToken } from "./registration";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const registrationToken = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

function bodyOf(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  const [, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("kayıt akışı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.set.mockClear();
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("kayıt başlatmayı işveren bayrağıyla birlikte gönderir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await startRegistration({
      firstName: "Ada",
      lastName: "Yılmaz",
      email: "ada@example.test",
      isEmployer: true,
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/auth/start-registration");
    // Alan adı JSON'da tam olarak `isEmployer`; backend `@JsonProperty` ile
    // sabitliyor ve eksikse 400 dönüyor.
    expect(bodyOf(fetchMock)).toEqual({
      firstName: "Ada",
      lastName: "Yılmaz",
      email: "ada@example.test",
      isEmployer: true,
    });
  });

  it("kayıt tokenını doğrulayıp parola belirleme tokenını döndürür", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, envelope({ setPasswordToken: "set-placeholder", isEmployer: false })),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyRegistrationToken(registrationToken)).resolves.toMatchObject({
      setPasswordToken: "set-placeholder",
    });
    expect(bodyOf(fetchMock)).toEqual({ registrationToken });
  });

  it("süresi dolmuş kayıt bağlantısını kodu bozmadan yükseltir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, {
          success: false,
          errorCode: "AUTH_REGISTRATION_TOKEN_EXPIRED",
          errorCategory: "TOKEN_EXPIRED",
          message: "Token suresi doldu.",
        }),
      ),
    );

    const error = await verifyRegistrationToken(registrationToken).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).errorCode).toBe("AUTH_REGISTRATION_TOKEN_EXPIRED");
  });

  it("kayıt tamamlanınca kullanıcıyı oturum açmış bırakır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        201,
        envelope({
          token: "access-placeholder",
          refreshToken: "refresh-placeholder",
          refreshExpiresAt: "2026-10-06T00:00:00Z",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await completeRegistration({
      setPasswordToken: "set-placeholder",
      password: "Koala2026",
      consents: [
        { agreementVersionId: "a1", granted: true },
        { agreementVersionId: "a3", granted: false },
      ],
    });

    expect(bodyOf(fetchMock)).toEqual({
      setPasswordToken: "set-placeholder",
      password: "Koala2026",
      consents: [
        { agreementVersionId: "a1", granted: true },
        { agreementVersionId: "a3", granted: false },
      ],
    });
    expect(cookieStore.set).toHaveBeenCalledWith(
      "koala_at",
      "access-placeholder",
      expect.objectContaining({ httpOnly: true, secure: true }),
    );
    // Oturum bu cihaza bağlandı; çerez ayrışırsa backend oturumu
    // pasifleştirir.
    expect(cookieStore.set).toHaveBeenCalledWith(
      "koala_did",
      deviceId,
      expect.objectContaining({ httpOnly: true, maxAge: 63_072_000 }),
    );
  });
});
