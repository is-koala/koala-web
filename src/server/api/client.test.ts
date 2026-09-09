import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch, apiFetchResponse } from "./client";
import { ApiError, isUpgradeRequired } from "./errors";

const deviceId = "webdevice0000000000000000000test";

function jsonResponse(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("BFF API istemcisi", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("başarı zarfından yalnız data alanını döndürür", async () => {
    stubFetch(
      jsonResponse(200, {
        success: true,
        message: "Giris basarili.",
        httpStatus: "OK",
        path: "/auth/login",
        timeStamp: "2026-01-01T00:00:00Z",
        requestId: "request-1",
        data: { token: "access-token-placeholder", refreshToken: "refresh-token-placeholder" },
      }),
    );

    await expect(apiFetch("/auth/login", { deviceId })).resolves.toEqual({
      token: "access-token-placeholder",
      refreshToken: "refresh-token-placeholder",
    });
  });

  it("hata zarfını kod, kategori, detay ve requestId taşıyan tipli hataya çevirir", async () => {
    stubFetch(
      jsonResponse(400, {
        success: false,
        message: "Gonderdigin bilgiler gecerli degil.",
        httpStatus: "BAD_REQUEST",
        path: "/jobs",
        timeStamp: "2026-01-01T00:00:00Z",
        requestId: "request-2",
        errorCode: "JOB_SALARY_MIN_VALUE",
        errorCategory: "VALIDATION_FAILED",
        details: [{ field: "salary", message: "Asgari ucretin altinda olamaz." }],
      }),
    );

    const failure = await apiFetch("/jobs", { deviceId }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 400,
      errorCode: "JOB_SALARY_MIN_VALUE",
      errorCategory: "VALIDATION_FAILED",
      message: "Gonderdigin bilgiler gecerli degil.",
      requestId: "request-2",
      details: [{ field: "salary", message: "Asgari ucretin altinda olamaz." }],
    });
  });

  it("her backend çağrısına BFF başlıklarını ekler", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { success: true, data: null }));

    await apiFetch("/users/me", { deviceId });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/users/me");
    const headers = new Headers(init.headers);
    expect(headers.get("Accept-Language")).toBe("tr");
    expect(headers.get("X-Device-Id")).toBe(deviceId);
    expect(headers.get("X-App-Version")).toBe("1.4.0");
    expect(headers.get("X-Client-Platform")).toBe("web");
  });

  it("gövdeli çağrıyı JSON olarak ve erişim tokenını Bearer başlığıyla gönderir", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { success: true, data: null }));

    await apiFetch("/auth/logout", {
      deviceId,
      method: "POST",
      body: { reason: "user" },
      accessToken: "access-token-placeholder",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"reason":"user"}');
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer access-token-placeholder");
  });

  it("multipart gövdeyi sınır başlığını bozmadan backend'e aktarır", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { success: true, data: null }));
    const body = new FormData();
    body.set("image", new File(["koala"], "profil.webp", { type: "image/webp" }));

    await apiFetch("/users/me/profile-picture", {
      deviceId,
      method: "PUT",
      body,
      accessToken: "access-token-placeholder",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(body);
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
  });

  it("dosya yanıtını zarf diye okumadan BFF başlıklarıyla taşır", async () => {
    const fetchMock = stubFetch(new Response("kanıt", {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "attachment; filename=kanit.pdf",
      },
    }));

    const signal = new AbortController().signal;
    const response = await apiFetchResponse("/disputes/1/evidence/2/download", {
      deviceId,
      accessToken: "access-token-placeholder",
      cache: "no-store",
      signal,
    });

    expect(await response.text()).toBe("kanıt");
    expect(response.headers.get("content-disposition")).toBe("attachment; filename=kanit.pdf");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access-token-placeholder");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBe(signal);
  });

  it("dosya indirme yönlendirmesini kimlik başlıklarıyla otomatik izlemez", async () => {
    const fetchMock = stubFetch(new Response(null, {
      status: 302,
      headers: { location: "https://bucket.s3.eu-central-1.amazonaws.com/evidence.pdf" },
    }));

    const response = await apiFetchResponse("/disputes/1/evidence/2/download", {
      deviceId,
      accessToken: "access-token-placeholder",
      cache: "no-store",
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.redirect).toBe("manual");
  });

  it("erişim tokenı yokken Authorization başlığı göndermez", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { success: true, data: null }));

    await apiFetch("/legal/agreements", { deviceId });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("426 yanıtını minimum sürümü koruyarak sayfa yenileme durumuna çevirir", async () => {
    stubFetch(
      jsonResponse(
        426,
        {
          success: false,
          httpStatus: "UPGRADE_REQUIRED",
          errorCategory: "CLIENT_TOO_OLD",
          errorCode: "UPGRADE_REQUIRED",
          message: "Lutfen uygulamayi guncelleyin.",
          path: "/users/me",
          timeStamp: "2026-01-01T00:00:00Z",
        },
        { "X-Minimum-App-Version": "2.0.0" },
      ),
    );

    const failure = await apiFetch("/users/me", { deviceId }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(isUpgradeRequired(failure)).toBe(true);
    expect(failure).toMatchObject({
      status: 426,
      errorCode: "UPGRADE_REQUIRED",
      errorCategory: "CLIENT_TOO_OLD",
      minimumAppVersion: "2.0.0",
    });
  });

  it("zarf olmayan ağ geçidi hatasını da tipli hataya çevirir", async () => {
    stubFetch(
      new Response("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
    );

    const failure = await apiFetch("/users/me", { deviceId }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 502, errorCode: "UNEXPECTED" });
  });

  it("200 ile gelen okunamayan gövdeyi sessizce boş veri saymaz", async () => {
    stubFetch(
      new Response("<html>oturum sayfası</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    const failure = await apiFetch("/users/me", { deviceId }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 200, errorCode: "UNEXPECTED" });
  });

  it("başarısız işaretli zarfı 200 ile gelse de hata sayar", async () => {
    stubFetch(
      jsonResponse(200, {
        success: false,
        message: "Islem tamamlanamadi.",
        errorCode: "JOB_NOT_OPEN",
        errorCategory: "DATA_CONFLICT",
      }),
    );

    const failure = await apiFetch("/jobs/1", { deviceId }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ errorCode: "JOB_NOT_OPEN" });
  });

  it("gövdesiz başarı yanıtında veri yerine null döndürür", async () => {
    stubFetch(new Response(null, { status: 204 }));

    await expect(apiFetch("/notifications/read", { deviceId, method: "POST" })).resolves.toBeNull();
  });

  it("backend'in yok sayacağı cihaz kimliğiyle ağa hiç çıkmaz", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { success: true, data: null }));

    // Boş kimlik backend'de sessizce null'a düşer ve web login/refresh
    // çağrıları anlaşılmaz bir doğrulama hatasıyla reddedilir.
    await expect(apiFetch("/users/me", { deviceId: "" })).rejects.toThrow(
      "Cihaz kimliği backend biçimine uymuyor.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("istemci IP'sini tek bir X-Forwarded-For değeri olarak yazar", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { success: true, data: null }));

    await apiFetch("/users/me", { deviceId, clientIp: "203.0.113.7" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("X-Forwarded-For")).toBe("203.0.113.7");
  });

  it("istemci IP'si bilinmiyorsa iletme başlığı üretmez", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { success: true, data: null }));

    await apiFetch("/users/me", { deviceId });

    const headers = new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers);
    expect(headers.has("X-Forwarded-For")).toBe(false);
    expect(headers.has("Forwarded")).toBe(false);
  });
});
