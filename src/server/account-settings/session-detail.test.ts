import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";
import { redirectTo } from "../../../tests/support/navigation";

import {
  getSessionDetail,
  isSessionDetailAvailable,
  renameDevice,
  sessionDetailView,
} from "./session-detail";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const sessionId = "4ace3ee5-f9fd-420c-8926-b35f2b82915a";
const deviceUuid = "30c46a8e-3e1b-4c35-b616-550171243a8b";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});
vi.mock("next/navigation", async () => ({
  redirect: (await import("../../../tests/support/navigation")).throwingRedirect(),
  unstable_rethrow: (await import("../../../tests/support/navigation")).rethrowTestNavigationError,
}));

/** `SessionDetailDto`, her alanı dolu. */
const fullDto = {
  id: sessionId,
  deviceId: deviceUuid,
  deviceType: "IOS",
  deviceName: "Evdeki iPad",
  deviceCustomName: "Evdeki iPad",
  createdAt: "2026-09-01T12:00:00Z",
  lastAccessedAt: "2026-09-06T12:00:00Z",
  refreshExpiresAt: "2026-10-06T12:00:00Z",
  ipAddress: "192.0.2.1",
  location: "İstanbul, TR",
  current: false,
  logins: 7,
  loginHistory: [
    { at: "2026-09-06T12:00:00Z", ipAddress: "192.0.2.1", location: "İstanbul, TR", success: true },
    { at: "2026-09-05T12:00:00Z", ipAddress: "198.51.100.7", location: null, success: false },
  ],
};

function notFound() {
  return jsonResponse(404, {
    success: false,
    errorCode: "SESSION_NOT_FOUND",
    errorCategory: "RESOURCE_NOT_FOUND",
    message: "Oturum bulunamadi.",
  });
}

/** 0.9.28 öncesi sunucu: yol yalnız `DELETE` biliyor, Spring `GET`'e 405 döner. */
function methodNotAllowed() {
  return new Response("", { status: 405 });
}

describe("oturum ayrıntısı sözleşmesi", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    requestHeaders.set("x-koala-path", `/panel/oturum/${sessionId}`);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("dolu DTO'yu alan alan taşır", () => {
    expect(sessionDetailView(fullDto, sessionId)).toEqual({
      id: sessionId,
      deviceId: deviceUuid,
      deviceType: "IOS",
      deviceName: "Evdeki iPad",
      deviceCustomName: "Evdeki iPad",
      ipAddress: "192.0.2.1",
      location: "İstanbul, TR",
      createdAt: "2026-09-01T12:00:00Z",
      lastAccessedAt: "2026-09-06T12:00:00Z",
      refreshExpiresAt: "2026-10-06T12:00:00Z",
      current: false,
      logins: 7,
      loginHistory: [
        { at: "2026-09-06T12:00:00Z", ipAddress: "192.0.2.1", location: "İstanbul, TR", success: true },
        { at: "2026-09-05T12:00:00Z", ipAddress: "198.51.100.7", location: null, success: false },
      ],
    });
  });

  it("boş ve eksik alanları null'a, geçmişi boş listeye indirger", () => {
    // Eski oturumlarda IP ve konum hiç yazılmamış olabiliyor; geçmiş yalnız
    // güncellemeden sonraki girişleri kapsıyor. Boş dize de "yok" sayılır ki
    // ekranda tire yerine boşluk kalmasın.
    expect(
      sessionDetailView(
        {
          id: sessionId,
          deviceId: deviceUuid,
          deviceType: null,
          deviceName: "",
          deviceCustomName: null,
          ipAddress: "   ",
          location: null,
          current: true,
        },
        sessionId,
      ),
    ).toEqual({
      id: sessionId,
      deviceId: deviceUuid,
      deviceType: "UNKNOWN",
      deviceName: null,
      deviceCustomName: null,
      ipAddress: null,
      location: null,
      createdAt: null,
      lastAccessedAt: null,
      refreshExpiresAt: null,
      current: true,
      logins: 0,
      loginHistory: [],
    });
  });

  it("ayrıntıyı oturum ucundan okur ve ekran biçimine çevirir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(fullDto)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSessionDetail(sessionId)).resolves.toMatchObject({
      id: sessionId,
      deviceName: "Evdeki iPad",
      logins: 7,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://api.example.test/users/me/sessions/${sessionId}`,
    );
    expect(new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers).get("Authorization")).toBe(
      "Bearer access-placeholder",
    );
  });

  it.each([
    ["404 (başkasının ya da kapatılmış oturum)", notFound],
    ["405 (0.9.28 öncesi sunucu)", methodNotAllowed],
  ])("%s yanıtında null döner", async (_name, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));

    await expect(getSessionDetail(sessionId)).resolves.toBeNull();
  });

  it("öbür hataları olduğu gibi fırlatır; sayfa hata kartını kendisi çizer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(503, {
          success: false,
          errorCode: "SERVICE_UNAVAILABLE",
          errorCategory: "UNEXPECTED",
          message: "Bakım.",
        }),
      ),
    );

    const error = await getSessionDetail(sessionId).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
  });

  it("süresi dolan oturumu hata değil giriş yönlendirmesi olarak geçirir", async () => {
    // Her çağrıya taze gövde: 401 sonrası yenileme de aynı yanıtı alıyor.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          jsonResponse(401, {
            success: false,
            errorCode: "UNAUTHORIZED",
            errorCategory: "AUTHENTICATION",
            message: "Oturum sona erdi.",
          }),
        ),
      ),
    );

    await expect(getSessionDetail(sessionId)).rejects.toThrow(
      redirectTo(`/giris?next=%2Fpanel%2Foturum%2F${sessionId}`),
    );
  });

  it.each([
    ["200", () => jsonResponse(200, envelope(fullDto)), true],
    ["404", notFound, false],
    ["405", methodNotAllowed, false],
    // Geçici arıza satırları bağlantısız bırakmamalı; sayfa kendi hata
    // kartını çizer.
    [
      "503",
      () =>
        jsonResponse(503, {
          success: false,
          errorCode: "SERVICE_UNAVAILABLE",
          errorCategory: "UNEXPECTED",
          message: "Bakım.",
        }),
      true,
    ],
  ])("ayrıntı ucu denemesinde %s yanıtını okur", async (_status, response, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));

    await expect(isSessionDetailAvailable(sessionId)).resolves.toBe(expected);
  });

  it("cihazı PATCH ile adlandırır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        200,
        envelope({
          id: deviceUuid,
          type: "IOS",
          name: "Evdeki iPad",
          customName: "Evdeki iPad",
          firstSeenAt: "2026-09-01T12:00:00Z",
          lastSeenAt: "2026-09-06T12:00:00Z",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(renameDevice(deviceUuid, "Evdeki iPad")).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/users/me/devices/${deviceUuid}`);
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"name":"Evdeki iPad"}');
  });

  it("backend'in 400 reddini alan hatasıyla birlikte fırlatır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          success: false,
          errorCode: "VALIDATION_FAILED",
          errorCategory: "VALIDATION",
          message: "Dogrulama hatasi.",
          details: [{ field: "name", message: "Cihaz adı en fazla 60 karakter olabilir." }],
        }),
      ),
    );

    const error = await renameDevice(deviceUuid, "x".repeat(61)).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).details).toEqual([
      { field: "name", message: "Cihaz adı en fazla 60 karakter olabilir." },
    ]);
  });
});
