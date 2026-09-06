import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../../../../../tests/support/session-cookies";

import { removeContactAction } from "./actions";

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/headers", async () => {
  const support = await import("../../../../../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "11111111-1111-4111-8111-111111111111";

describe("yetkili çıkarma Server Action'ı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", `/isveren/sirket/${companyId}/yetkililer`);
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    revalidatePath.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("kişiyi çıkarır ve listeyi o şirketin sayfasında tazeler", async () => {
    const fetchMock = successfulFetch();

    await expect(
      removeContactAction(companyId, userId, idleFormState, new FormData()),
    ).resolves.toEqual({ status: "done" });

    expect(requestOf(fetchMock)).toMatchObject({
      url: `https://api.example.test/companies/${companyId}/contacts/${userId}`,
      method: "DELETE",
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/isveren/sirket/${companyId}/yetkililer`);
  });

  it("kimlik biçimi bozuk olduğunda backend'e hiç çıkmaz", async () => {
    // İki kimlik de adres çubuğundan ve form gövdesinden geliyor. Doğrulama
    // burada olmasaydı uydurulmuş bir değer, kullanıcıya `errorCode`
    // taşımayan bir sunucu hatası olarak dönerdi.
    const fetchMock = successfulFetch();

    const state = await removeContactAction("not-a-uuid", userId, idleFormState, new FormData());

    expect(state).toMatchObject({ status: "error", httpStatus: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("son yönetici reddini kendi koduyla forma taşır", async () => {
    // Metne göre dallanmak yasak: form üst bandındaki cümleyi `errorCode`
    // üzerinden `errorPresentation` seçiyor.
    failingFetch(409, "COMPANY_LAST_ADMIN_CANNOT_BE_REMOVED");

    await expect(
      removeContactAction(companyId, userId, idleFormState, new FormData()),
    ).resolves.toMatchObject({
      status: "error",
      errorCode: "COMPANY_LAST_ADMIN_CANNOT_BE_REMOVED",
      httpStatus: 409,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("yetkisiz çağrının 404'ünü olduğu gibi taşır", async () => {
    // Uç yetkisizliği "yok" ile aynı yanıtta birleştiriyor; action ikisini
    // ayırmaya çalışmaz, kodu olduğu gibi yukarı verir.
    failingFetch(404, "USER_NOT_ASSOCIATED_WITH_COMPANY");

    await expect(
      removeContactAction(companyId, userId, idleFormState, new FormData()),
    ).resolves.toMatchObject({
      status: "error",
      errorCode: "USER_NOT_ASSOCIATED_WITH_COMPANY",
      httpStatus: 404,
    });
  });
});

function successfulFetch() {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(jsonResponse(200, envelope(null))),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function failingFetch(status: number, errorCode: string) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(jsonResponse(status, { success: false, errorCode, message: "ham metin" })),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestOf(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return { url, method: init.method };
}
