import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";
import { redirectTo } from "../../../tests/support/navigation";

import { renameDeviceAction, revokeSessionFromDetailAction } from "./oturum-actions";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const sessionId = "4ace3ee5-f9fd-420c-8926-b35f2b82915a";
const deviceUuid = "30c46a8e-3e1b-4c35-b616-550171243a8b";
const detailPath = `/panel/oturum/${sessionId}`;

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
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

function renamedDevice(name: string) {
  return jsonResponse(
    200,
    envelope({
      id: deviceUuid,
      type: "IOS",
      name,
      customName: name,
      firstSeenAt: "2026-09-01T12:00:00Z",
      lastSeenAt: "2026-09-06T12:00:00Z",
    }),
  );
}

function fields(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(values)) formData.set(name, value);
  return formData;
}

const rename = (values: Record<string, string>) =>
  renameDeviceAction("worker", { status: "idle" }, fields({ sessionId, deviceId: deviceUuid, ...values }));

describe("oturum ayrıntısı action'ları", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    requestHeaders.set("x-koala-path", detailPath);
    revalidatePath.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("oturumu action içinde yeniden doğrular", async () => {
    cookieStore.values.delete("koala_at");
    cookieStore.values.delete("koala_rt");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(rename({ name: "Evdeki iPad" })).rejects.toThrow(
      redirectTo(`/giris?next=${encodeURIComponent(detailPath)}`),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adı kırpıp PATCH ile yazar, ayrıntıyı ve iki hesap sayfasını tazeler", async () => {
    const fetchMock = vi.fn().mockResolvedValue(renamedDevice("Evdeki iPad"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(rename({ name: "  Evdeki iPad  " })).resolves.toEqual({ status: "done" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/users/me/devices/${deviceUuid}`);
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"name":"Evdeki iPad"}');
    expect(revalidatePath).toHaveBeenCalledWith(detailPath);
    expect(revalidatePath).toHaveBeenCalledWith("/panel/hesap");
    expect(revalidatePath).toHaveBeenCalledWith("/isveren/hesap");
  });

  it.each([
    ["boş", "   ", "Cihaza bir ad ver."],
    ["61 karakter", "x".repeat(61), "Cihaz adı en fazla 60 karakter olabilir."],
  ])("%s adı backend'e gitmeden alan hatasıyla reddeder", async (_name, name, message) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(rename({ name })).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { name: message },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tam 60 karakteri kabul eder; sınır backend'in sınırı", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(renamedDevice("x".repeat(60))));

    await expect(rename({ name: "x".repeat(60) })).resolves.toEqual({ status: "done" });
  });

  it("backend'in 400 reddini alan hatası olarak forma taşır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          success: false,
          errorCode: "VALIDATION_FAILED",
          errorCategory: "VALIDATION",
          message: "Dogrulama hatasi.",
          details: [{ field: "name", message: "Cihaz adı boş olamaz." }],
        }),
      ),
    );

    await expect(rename({ name: "Evdeki iPad" })).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { name: "Cihaz adı boş olamaz." },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("başkasının cihazına verilen 404'ü hata durumu olarak döndürür", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(404, {
          success: false,
          errorCode: "DEVICE_NOT_FOUND",
          errorCategory: "RESOURCE_NOT_FOUND",
          message: "Cihaz bulunamadi.",
        }),
      ),
    );

    await expect(rename({ name: "Evdeki iPad" })).resolves.toMatchObject({
      status: "error",
      errorCode: "DEVICE_NOT_FOUND",
      httpStatus: 404,
    });
  });

  it("biçimsiz kimlikleri yola koymadan reddeder", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(rename({ deviceId: "../admin", name: "Evdeki iPad" })).resolves.toMatchObject({
      status: "error",
      fieldErrors: { name: "Kaynak kimliği geçerli değil." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("oturumu kapatınca kabuğun hesap sayfasındaki listeye yönlendirir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(null)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      revokeSessionFromDetailAction("employer", { status: "idle" }, fields({ sessionId })),
    ).rejects.toThrow(redirectTo("/isveren/hesap#oturumlar"));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/users/me/sessions/${sessionId}`);
    expect(init.method).toBe("DELETE");
    expect(revalidatePath).toHaveBeenCalledWith("/isveren/hesap");
  });

  it("kapatma reddedilirse yönlendirmez, hata durumunu forma döndürür", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(404, {
          success: false,
          errorCode: "SESSION_NOT_FOUND",
          errorCategory: "RESOURCE_NOT_FOUND",
          message: "Oturum bulunamadi.",
        }),
      ),
    );

    await expect(
      revokeSessionFromDetailAction("worker", { status: "idle" }, fields({ sessionId })),
    ).resolves.toMatchObject({ status: "error", errorCode: "SESSION_NOT_FOUND", httpStatus: 404 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
