import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorPresentation } from "@/lib/errors";
import { ApiError } from "@/server/api/errors";

import { cookieStore, envelope, jsonResponse } from "../../../tests/support/session-cookies";

import { signIn } from "./login";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

/** Kayıtlı olmayan adres: `UserManager.getByEmail` kaydı bulamıyor. */
function unknownEmail() {
  return jsonResponse(404, {
    success: false,
    httpStatus: "NOT_FOUND",
    errorCode: "USER_NOT_FOUND_BY_EMAIL",
    errorCategory: "RESOURCE_NOT_FOUND",
    message: "Kullanici bulunamadi.",
  });
}

/** Kayıtlı adres, yanlış parola. */
function wrongPassword() {
  return jsonResponse(401, {
    success: false,
    httpStatus: "UNAUTHORIZED",
    errorCode: "AUTH_EMAIL_OR_PASSWORD_MISMATCH",
    errorCategory: "INVALID_CREDENTIALS",
    message: "E-posta ya da parola hatali.",
  });
}

function tokenResponse() {
  return jsonResponse(
    200,
    envelope({
      token: "access-placeholder",
      refreshToken: "refresh-placeholder",
      refreshExpiresAt: "2026-10-06T00:00:00Z",
    }),
  );
}

const credentials = { email: "aday@example.test", password: "parola-yer-tutucu" };

async function failureOf(response: Response) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  const error = await signIn(credentials).catch((thrown: unknown) => thrown);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe("giriş akışı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.set.mockClear();
    cookieStore.delete.mockClear();
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("kayıtsız e-posta ile yanlış parolayı aynı hataya indirger", async () => {
    // Backend bilinmeyen adrese 404, yanlış parolaya 401 dönüyor; ikisi
    // ayrışırsa giriş formu hangi adreslerin kayıtlı olduğunu söyler.
    const unknown = await failureOf(unknownEmail());
    const mismatch = await failureOf(wrongPassword());

    expect(unknown.errorCode).toBe(mismatch.errorCode);
    expect(unknown.status).toBe(mismatch.status);
    // Ham mesaj da ayrışmamalı: "Kullanici bulunamadi" tek başına adresin
    // kayıtlı olmadığını söylerdi.
    expect(unknown.message).toBe(mismatch.message);
    expect(unknown.message).not.toContain("bulunamadi");
    expect(errorPresentation(unknown.errorCode, unknown.status)).toEqual(
      errorPresentation(mismatch.errorCode, mismatch.status),
    );
  });

  it("gövdesi okunamayan 404'te bile 'içerik bulunamadı' demez", async () => {
    // Zarf okunamazsa `apiFetch` koda UNEXPECTED düşürür; kod eşlemesine
    // güvenen bir indirgeme burada delinir ve form 404 ailesine, yani
    // "Aradığın içerik bulunamadı" metnine düşerdi.
    const unreadable = await failureOf(
      new Response("<html>gateway</html>", { status: 404, headers: { "content-type": "text/html" } }),
    );

    expect(errorPresentation(unreadable.errorCode, unreadable.status).title).toBe(
      "Giriş bilgileri uyuşmuyor",
    );
  });

  it("oturum tokenlarını yalnız HttpOnly çerezlere yazar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(tokenResponse()));

    await signIn(credentials);

    expect(cookieStore.set).toHaveBeenCalledWith(
      "koala_at",
      "access-placeholder",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" }),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      "koala_rt",
      "refresh-placeholder",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" }),
    );
  });

  it("cihaz kimliği çerezini oturumun bağlandığı kimlikle yeniden yazar", async () => {
    // Çerez zaten aynı değeri taşısa bile Set-Cookie gönderilmeli: yarışta
    // geç düşen eski bir çerez ancak böyle üzerine yazılır.
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse());
    vi.stubGlobal("fetch", fetchMock);

    await signIn(credentials);

    const sent = new Headers(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers,
    ).get("X-Device-Id");
    expect(sent).toBe(deviceId);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "koala_did",
      deviceId,
      expect.objectContaining({ httpOnly: true, secure: true, maxAge: 63_072_000 }),
    );
  });

  it("çerez henüz düşmemişse ürettiği kimliği hem gönderir hem çereze yazar", async () => {
    // Vekil kimliği istek başına üretiyor: yarışta kaybeden çerez oturumu
    // bağlandığı cihazdan koparır ve backend oturumu pasifleştirir.
    cookieStore.values.delete("koala_did");
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse());
    vi.stubGlobal("fetch", fetchMock);

    await signIn(credentials);

    const sent = new Headers(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers,
    ).get("X-Device-Id");
    expect(sent).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    expect(cookieStore.values.get("koala_did")).toBe(sent);
  });

  it("her iki durumda da kullanıcıya giriş bilgilerinin uyuşmadığını söyler", async () => {
    const unknown = await failureOf(unknownEmail());

    expect(errorPresentation(unknown.errorCode, unknown.status)).toEqual({
      title: "Giriş bilgileri uyuşmuyor",
      message: "E-posta adresini ve parolanı kontrol ederek yeniden dene.",
      action: "none",
    });
  });
});
