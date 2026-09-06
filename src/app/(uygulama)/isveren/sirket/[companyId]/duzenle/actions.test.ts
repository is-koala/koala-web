import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../../../../../tests/support/session-cookies";

import {
  removeCompanyLogoAction,
  replaceCompanyLogoAction,
  updateCompanyAction,
} from "./actions";

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

function editForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    name: "Koala Temizlik",
    email: "bilgi@koala.test",
    phoneNumber: "05001112233",
    website: "",
    description: "",
    // Kilitli alanlar formda hiç yok; gövdeye girmediklerini de doğruluyoruz.
    ...overrides,
  };
  for (const [field, value] of Object.entries(fields)) formData.set(field, value);
  return formData;
}

describe("şirket düzenleme Server Action'ları", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", `/isveren/sirket/${companyId}/duzenle`);
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

  it("yalnız beş alanı PATCH ile gönderir ve iki ekranı da tazeler", async () => {
    // Profil bayat kalırsa kullanıcı kaydettiği değişikliği bir sonraki
    // durağında göremez ve kaydın düştüğünü sanar.
    const fetchMock = successfulFetch();

    await expect(updateCompanyAction(companyId, idleFormState, editForm())).resolves.toEqual({
      status: "done",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/companies/${companyId}`);
    expect(init.method).toBe("PATCH");
    expect(Object.keys(JSON.parse(init.body as string))).toEqual([
      "name",
      "email",
      "phoneNumber",
      "website",
      "description",
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/isveren/sirket/${companyId}/duzenle`);
    expect(revalidatePath).toHaveBeenCalledWith(`/isveren/sirket/${companyId}`);
  });

  it("kilitli alanları form gövdesine konsalar bile göndermez", async () => {
    // `taxNumber` ve `type` `UpdateCompanyRequestDto`'da yok: gövdeye
    // konduklarında backend onları sessizce yok sayar ve ekran değişmemiş
    // bir alanı değişmiş gibi gösterirdi.
    const fetchMock = successfulFetch();

    await updateCompanyAction(
      companyId,
      idleFormState,
      editForm({ taxNumber: "9999999999", type: "CORPORATION" }),
    );

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).not.toHaveProperty("taxNumber");
    expect(body).not.toHaveProperty("type");
  });

  it("kimlik biçimi bozuk olduğunda backend'e hiç çıkmaz", async () => {
    const fetchMock = successfulFetch();

    const state = await updateCompanyAction("not-a-uuid", idleFormState, editForm());

    expect(state).toMatchObject({ status: "error", httpStatus: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("yetkisiz düzenlemenin 404'ünü olduğu gibi taşır", async () => {
    // `requireCompanyAdmin` yetkisizliği "yok" ile aynı yanıtta birleştiriyor;
    // action ikisini ayırmaya çalışmaz.
    failingFetch(404, "USER_NOT_ASSOCIATED_WITH_COMPANY");

    await expect(updateCompanyAction(companyId, idleFormState, editForm())).resolves.toMatchObject({
      status: "error",
      errorCode: "USER_NOT_ASSOCIATED_WITH_COMPANY",
      httpStatus: 404,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("logoyu kendi ucuna multipart olarak yazar", async () => {
    const fetchMock = successfulFetch();
    const formData = new FormData();
    formData.set("logo", new File(["koala"], "logo.png", { type: "image/png" }));

    await expect(
      replaceCompanyLogoAction(companyId, idleFormState, formData),
    ).resolves.toEqual({ status: "done" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/companies/${companyId}/logo`);
    expect(init.method).toBe("PUT");
  });

  it("dosya seçilmemiş logo gönderimini backend'e taşımaz", async () => {
    // Tarayıcı boş dosya alanını sıfır baytlık bir `File` olarak gönderiyor;
    // backend onu "boş dosya" diye reddeder ve kullanıcı bunu arıza sanar.
    const fetchMock = successfulFetch();
    const formData = new FormData();
    formData.set("logo", new File([], ""));

    const state = await replaceCompanyLogoAction(companyId, idleFormState, formData);

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { logo: "Yüklenecek bir dosya seç." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logoyu kendi ucundan kaldırır", async () => {
    const fetchMock = successfulFetch();

    await expect(
      removeCompanyLogoAction(companyId, idleFormState, new FormData()),
    ).resolves.toEqual({ status: "done" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/companies/${companyId}/logo`);
    expect(init.method).toBe("DELETE");
  });
});

function successfulFetch() {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(jsonResponse(200, envelope({ id: companyId }))),
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
