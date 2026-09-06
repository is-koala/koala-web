import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cookieStore, envelope, jsonResponse } from "../../../tests/support/session-cookies";

import { signOut } from "./logout";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});
vi.mock("next/navigation", async () => ({
  redirect: (await import("../../../tests/support/navigation")).throwingRedirect(),
}));

/** `AuthManager.logout` pasifleşmiş oturumu bulamayınca 404 döner. */
function sessionAlreadyClosed() {
  return jsonResponse(404, {
    success: false,
    httpStatus: "NOT_FOUND",
    errorCode: "AUTH_SESSION_NOT_FOUND_OR_INACTIVE",
    errorCategory: "RESOURCE_NOT_FOUND",
    message: "Oturum bulunamadi.",
  });
}

function seedSession(tokens: Record<string, string> = {}) {
  cookieStore.values.clear();
  cookieStore.values.set("koala_did", deviceId);
  for (const [name, value] of Object.entries(tokens)) cookieStore.values.set(name, value);
}

describe("çıkış akışı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.set.mockClear();
    cookieStore.delete.mockClear();
    seedSession({ koala_at: "access-placeholder", koala_rt: "refresh-placeholder" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("oturumu backend'de kapatır ve çerezleri siler", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await signOut();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/auth/logout");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-placeholder");
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_at");
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_rt");
  });

  it("oturum zaten kapalıyken 404 alsa da çerezleri siler", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sessionAlreadyClosed()));

    await expect(signOut()).resolves.toBeUndefined();

    expect(cookieStore.delete).toHaveBeenCalledWith("koala_at");
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_rt");
  });

  it("taşınacak oturum yokken backend'i hiç aramaz", async () => {
    seedSession();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await signOut();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_at");
  });

  it("cihaz kimliğini korur: tarayıcı profili çıkışta değişmez", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope(null))));

    await signOut();

    expect(cookieStore.delete).not.toHaveBeenCalledWith("koala_did");
    expect(cookieStore.values.get("koala_did")).toBe(deviceId);
  });
});
