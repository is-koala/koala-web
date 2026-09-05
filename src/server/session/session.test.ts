import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { SessionExpiredError } from "./refresh";
import { apiRequest } from "./session";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";

const store = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    set: vi.fn((name: string, value: string) => {
      values.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      values.delete(name);
    }),
    get: (name: string) => (values.has(name) ? { name, value: values.get(name)! } : undefined),
  };
});

const requestHeaders = vi.hoisted(() => new Headers());

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(store),
  headers: () => Promise.resolve(requestHeaders),
}));
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new Error(`REDIRECT:${target}`);
  },
}));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function envelope(data: unknown) {
  return { success: true, httpStatus: "OK", data };
}

function unauthorized() {
  return jsonResponse(401, {
    success: false,
    httpStatus: "UNAUTHORIZED",
    errorCode: "TOKEN_EXPIRED",
    errorCategory: "TOKEN_EXPIRED",
    message: "Oturum suresi doldu.",
  });
}

function seedSession(tokens: Record<string, string> = {}) {
  store.values.clear();
  store.values.set("koala_did", deviceId);
  for (const [name, value] of Object.entries(tokens)) store.values.set(name, value);
}

describe("BFF oturum katmanı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.delete("x-real-ip");
    store.set.mockClear();
    store.delete.mockClear();
    seedSession({ koala_at: "access-placeholder", koala_rt: "refresh-placeholder" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("çerezdeki erişim tokenı ve cihaz kimliğiyle çağırır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope({ id: "u1" })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/users/me")).resolves.toEqual({ id: "u1" });

    const headers = new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers);
    expect(headers.get("Authorization")).toBe("Bearer access-placeholder");
    expect(headers.get("X-Device-Id")).toBe(deviceId);
  });

  it("401 sonrası eski erişim tokenıyla yenileyip özgün isteği tekrarlar", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          envelope({
            token: "yeni-access-placeholder",
            refreshToken: "refresh-placeholder",
            refreshExpiresAt: "2026-10-06T00:00:00Z",
          }),
        ),
      )
      .mockResolvedValueOnce(jsonResponse(200, envelope({ id: "u1" })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/users/me")).resolves.toEqual({ id: "u1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(refreshUrl).toBe("https://api.example.test/auth/refresh-token");
    expect(refreshInit.method).toBe("POST");
    expect(refreshInit.body).toBe('{"refreshToken":"refresh-placeholder"}');
    const refreshHeaders = new Headers(refreshInit.headers);
    // Backend süresi dolmuş erişim tokenından oturum kimliğini çıkarır;
    // başlık düşerse yenileme 401 döner.
    expect(refreshHeaders.get("Authorization")).toBe("Bearer access-placeholder");
    expect(refreshHeaders.get("X-Device-Id")).toBe(deviceId);

    const retryHeaders = new Headers((fetchMock.mock.calls[2] as [string, RequestInit])[1].headers);
    expect(retryHeaders.get("Authorization")).toBe("Bearer yeni-access-placeholder");
  });

  it("yenilenen tokenları HttpOnly çerezlere yazar", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(unauthorized())
        .mockResolvedValueOnce(
          jsonResponse(
            200,
            envelope({
              token: "yeni-access-placeholder",
              refreshToken: "yeni-refresh-placeholder",
              refreshExpiresAt: "2026-10-06T00:00:00Z",
            }),
          ),
        )
        .mockResolvedValueOnce(jsonResponse(200, envelope(null))),
    );

    await apiRequest("/users/me");

    expect(store.set).toHaveBeenCalledWith(
      "koala_at",
      "yeni-access-placeholder",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" }),
    );
    expect(store.set).toHaveBeenCalledWith(
      "koala_rt",
      "yeni-refresh-placeholder",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" }),
    );
  });

  it("eşzamanlı üç 401 tek yenileme çağrısı üretir", async () => {
    let releaseRefresh = () => {};
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    let refreshCalls = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/auth/refresh-token")) {
          refreshCalls += 1;
          await refreshGate;
          return jsonResponse(
            200,
            envelope({
              token: "yeni-access-placeholder",
              refreshToken: "refresh-placeholder",
              refreshExpiresAt: "2026-10-06T00:00:00Z",
            }),
          );
        }
        const authorization = new Headers(init.headers).get("Authorization");
        return authorization === "Bearer access-placeholder"
          ? unauthorized()
          : jsonResponse(200, envelope({ id: "u1" }));
      }),
    );

    const pending = Promise.all([
      apiRequest("/users/me"),
      apiRequest("/jobs"),
      apiRequest("/notifications"),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseRefresh();

    await expect(pending).resolves.toEqual([{ id: "u1" }, { id: "u1" }, { id: "u1" }]);
    expect(refreshCalls).toBe(1);
  });

  it("yenileme de reddedilirse çerezleri temizler ve girişe yönlendirir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized()),
    );

    await expect(apiRequest("/users/me")).rejects.toThrow("REDIRECT:/giris");
    expect(store.delete).toHaveBeenCalledWith("koala_at");
    expect(store.delete).toHaveBeenCalledWith("koala_rt");
  });

  it("ingress'in yazdığı istemci IP'sini tek X-Forwarded-For olarak iletir", async () => {
    requestHeaders.set("x-real-ip", "203.0.113.7");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/users/me");

    const headers = new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers);
    expect(headers.get("X-Forwarded-For")).toBe("203.0.113.7");
  });

  it("tarayıcının gönderdiği iletme başlıklarını backend'e taşımaz", async () => {
    requestHeaders.set("x-forwarded-for", "1.2.3.4");
    requestHeaders.set("forwarded", "for=1.2.3.4");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/users/me");

    const headers = new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers);
    expect(headers.has("X-Forwarded-For")).toBe(false);
    expect(headers.has("Forwarded")).toBe(false);
    requestHeaders.delete("x-forwarded-for");
    requestHeaders.delete("forwarded");
  });

  it("oturum bittiğinde kullanıcıyı girişe yollar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized()),
    );

    await expect(apiRequest("/users/me")).rejects.toThrow("REDIRECT:/giris");
  });

  it("yenileme sunucu hatasıyla düşerse oturumu silmez", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(unauthorized())
        .mockResolvedValueOnce(
          jsonResponse(500, {
            success: false,
            httpStatus: "INTERNAL_SERVER_ERROR",
            errorCode: "UNEXPECTED",
            errorCategory: "UNEXPECTED",
            message: "Beklenmeyen hata.",
          }),
        ),
    );

    const failure = await apiRequest("/users/me").catch((error: unknown) => error);

    // Geçici backend arızası oturumu bitirmez; kullanıcı yeniden denemekle
    // kurtulabilecekken çıkışa zorlanmamalı.
    expect(failure).not.toBeInstanceOf(SessionExpiredError);
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("yenileme tokenı yokken yenilemeyi denemez", async () => {
    seedSession({ koala_at: "access-placeholder" });
    const fetchMock = vi.fn().mockResolvedValue(unauthorized());
    vi.stubGlobal("fetch", fetchMock);

    const failure = await apiRequest("/users/me").catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
