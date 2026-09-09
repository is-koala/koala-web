import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { redirectTo } from "../../../tests/support/navigation";
import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders as testRequestHeaders,
} from "../../../tests/support/session-cookies";

import { SessionExpiredError } from "./refresh";
import { apiRequest, apiRequestResponse } from "./session";

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

function unauthorized() {
  return jsonResponse(401, {
    success: false,
    httpStatus: "UNAUTHORIZED",
    errorCode: "TOKEN_EXPIRED",
    errorCategory: "TOKEN_EXPIRED",
    message: "Oturum suresi doldu.",
  });
}

/** Oturum sunucuda pasifleştiyse `findActiveSessionById` 404 döndürür. */
function sessionNotFound() {
  return jsonResponse(404, {
    success: false,
    httpStatus: "NOT_FOUND",
    errorCode: "SESSION_NOT_FOUND",
    errorCategory: "RESOURCE_NOT_FOUND",
    message: "Oturum bulunamadi.",
  });
}

function seedSession(tokens: Record<string, string> = {}) {
  cookieStore.values.clear();
  cookieStore.values.set("koala_did", deviceId);
  for (const [name, value] of Object.entries(tokens)) cookieStore.values.set(name, value);
}

describe("BFF oturum katmanı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    testRequestHeaders.delete("x-real-ip");
    testRequestHeaders.delete("x-koala-path");
    cookieStore.set.mockClear();
    cookieStore.delete.mockClear();
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

  it("dosya yanıtını 401 sonrası yenileyip ham gövdesiyle döndürür", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(
        jsonResponse(200, envelope({
          token: "yeni-access-placeholder",
          refreshToken: "refresh-placeholder",
          refreshExpiresAt: "2026-10-06T00:00:00Z",
        })),
      )
      .mockResolvedValueOnce(new Response("kanıt", {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await apiRequestResponse("/disputes/1/evidence/2/download", {
      cache: "no-store",
    });

    expect(await response.text()).toBe("kanıt");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryHeaders = new Headers((fetchMock.mock.calls[2] as [string, RequestInit])[1].headers);
    expect(retryHeaders.get("Authorization")).toBe("Bearer yeni-access-placeholder");
  });

  it("dosya isteği iptal edilince paylaşılan yenilemeyi bozmadan beklemeyi bırakır", async () => {
    const controller = new AbortController();
    let releaseRefresh: (response: Response) => void = () => undefined;
    let refreshSignal: AbortSignal | null = null;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(unauthorized())
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        refreshSignal = init.signal as AbortSignal;
        return new Promise<Response>((resolve) => {
          releaseRefresh = resolve;
        });
      });
    vi.stubGlobal("fetch", fetchMock);

    const pending = apiRequestResponse("/disputes/1/evidence/2/download", {
      cache: "no-store",
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    controller.abort();

    try {
      const outcome = await Promise.race([
        pending.then(() => "resolved", () => "aborted"),
        new Promise<string>((resolve) => setTimeout(() => resolve("still-pending"), 50)),
      ]);
      expect(outcome).toBe("aborted");
      expect(refreshSignal).toBeInstanceOf(AbortSignal);
      expect((refreshSignal as unknown as AbortSignal).aborted).toBe(false);
    } finally {
      releaseRefresh(jsonResponse(200, envelope({
        token: "yeni-access-placeholder",
        refreshToken: "refresh-placeholder",
        refreshExpiresAt: "2026-10-06T00:00:00Z",
      })));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
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

    expect(cookieStore.set).toHaveBeenCalledWith(
      "koala_at",
      "yeni-access-placeholder",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" }),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
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

    await expect(apiRequest("/users/me")).rejects.toThrowError(
      new Error(redirectTo("/giris")),
    );
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_at");
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_rt");
  });

  it("ingress'in yazdığı istemci IP'sini tek X-Forwarded-For olarak iletir", async () => {
    testRequestHeaders.set("x-real-ip", "203.0.113.7");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/users/me");

    const headers = new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers);
    expect(headers.get("X-Forwarded-For")).toBe("203.0.113.7");
  });

  it("tarayıcının gönderdiği iletme başlıklarını backend'e taşımaz", async () => {
    testRequestHeaders.set("x-forwarded-for", "1.2.3.4");
    testRequestHeaders.set("forwarded", "for=1.2.3.4");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/users/me");

    const headers = new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers);
    expect(headers.has("X-Forwarded-For")).toBe(false);
    expect(headers.has("Forwarded")).toBe(false);
    testRequestHeaders.delete("x-forwarded-for");
    testRequestHeaders.delete("forwarded");
  });

  it("oturum bittiğinde kullanıcıyı bıraktığı sayfayla birlikte girişe yollar", async () => {
    // Yolu vekil yazar; render sırasında server component kendi adresini
    // okuyamadığı için dönüş hedefinin tek kaynağı bu başlıktır.
    testRequestHeaders.set("x-koala-path", "/panel/islerim?filtre=acik");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized()),
    );

    await expect(apiRequest("/users/me")).rejects.toThrowError(
      new Error(redirectTo("/giris?next=%2Fpanel%2Fislerim%3Ffiltre%3Dacik")),
    );
  });

  it("dönüş hedefi siteden çıkıyorsa girişe next taşımadan yollar", async () => {
    testRequestHeaders.set("x-koala-path", "//kotu.example");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized()),
    );

    await expect(apiRequest("/users/me")).rejects.toThrowError(
      new Error(redirectTo("/giris")),
    );
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
    expect(cookieStore.delete).not.toHaveBeenCalled();
  });

  it("yenileme 404 dönerse çerezleri temizler ve girişe yönlendirir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(sessionNotFound()),
    );

    // Oturum sunucuda kapandığında yenileme 401 değil 404 döner; bunu geçici
    // arıza sayıp yeniden denemek 401 → yenile → 404 döngüsü üretirdi.
    await expect(apiRequest("/users/me")).rejects.toThrowError(
      new Error(redirectTo("/giris")),
    );
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_at");
    expect(cookieStore.delete).toHaveBeenCalledWith("koala_rt");
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
