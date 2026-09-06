import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../../../../tests/support/session-cookies";
import { redirectTo, throwingRedirect } from "../../../../../../tests/support/navigation";

import { createCompanyAction } from "./actions";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", async () => {
  const support = await import("../../../../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const address = {
  countryId: "11111111-1111-4111-8111-111111111111",
  cityId: "22222222-2222-4222-8222-222222222222",
  districtId: "33333333-3333-4333-8333-333333333333",
  components: {
    neighborhood: "Levent",
    thoroughfare: "Büyükdere Caddesi",
    buildingNumber: "12",
    postalCode: "34330",
  },
  position: { latitude: 41.081235, longitude: 29.008765, source: "AUTOCOMPLETE_CONFIRMED" },
  candidateToken: "aday-kaniti",
};

function completeForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    name: "Koala Temizlik",
    email: "bilgi@koala.test",
    phoneNumber: "05001112233",
    website: "",
    description: "",
    taxNumber: "1234567890",
    type: "LIMITED",
    address: JSON.stringify(address),
    ...overrides,
  };
  for (const [field, value] of Object.entries(fields)) formData.set(field, value);
  return formData;
}

describe("şirket oluşturma Server Action'ı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", "/isveren/sirket/yeni");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    redirect.mockReset();
    redirect.mockImplementation(throwingRedirect());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("şirketi kurar ve kullanıcıyı yeni şirketin profiline bırakır", async () => {
    // Oluşturma sonrası form geride kalmamalı: aynı form ikinci kez
    // gönderilirse silinemeyen ikinci bir şirket doğar.
    const fetchMock = successfulFetch({ id: companyId });

    await expect(createCompanyAction(idleFormState, completeForm())).rejects.toThrow(
      redirectTo(`/isveren/sirket/${companyId}`),
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/companies");
    expect(init.method).toBe("POST");
  });

  it("adres gövdesini yalnız kanonik biçimde geçirir", async () => {
    // Serbest metin bir adres ya da istemcide üretilmiş bir koordinat
    // gövdeye giremez: `readAddressWrite` sözleşmedeki alanları süzüyor.
    const fetchMock = successfulFetch({ id: companyId });

    await expect(createCompanyAction(idleFormState, completeForm())).rejects.toThrow();

    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData;
    const part = JSON.parse(await (body.get("company") as Blob).text());
    expect(part.address).toEqual(address);
  });

  it("adres onaylanmadan backend'e hiç çıkmaz", async () => {
    const fetchMock = successfulFetch({ id: companyId });

    const state = await createCompanyAction(idleFormState, completeForm({ address: "" }));

    expect(state).toMatchObject({ status: "error", httpStatus: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("eksik alanı sunucuda da yakalar ve tur atmaz", async () => {
    // Formdaki kopya bir kolaylık; devre dışı bırakılmış bir düğmenin
    // arkasındaki form yine de gönderilebilir.
    const fetchMock = successfulFetch({ id: companyId });

    const state = await createCompanyAction(idleFormState, completeForm({ taxNumber: " " }));

    expect(state).toMatchObject({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      fieldErrors: { taxNumber: "Vergi numarası zorunlu." },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("kimlik reddini kendi koduyla forma taşır", async () => {
    // Metne göre dallanmak yasak: üst banttaki cümleyi `errorCode` seçiyor.
    failingFetch(400, "USER_MUST_VERIFY_IDENTITY");

    await expect(createCompanyAction(idleFormState, completeForm())).resolves.toMatchObject({
      status: "error",
      errorCode: "USER_MUST_VERIFY_IDENTITY",
      httpStatus: 400,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sunucunun alan hatalarını forma geri yazar", async () => {
    // `details[]` içindeki metin backend'de zaten Türkçe çözülüyor ve alan
    // adları DTO adlarıyla aynı olduğu için eşleme dönüştürme istemiyor.
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse(400, {
          success: false,
          errorCode: "VALIDATION_FAILED",
          message: "ham metin",
          details: [{ field: "email", message: "Geçerli bir e-posta adresi giriniz." }],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createCompanyAction(idleFormState, completeForm())).resolves.toMatchObject({
      status: "error",
      fieldErrors: { email: "Geçerli bir e-posta adresi giriniz." },
    });
  });

  it("kimliği okunamayan yanıtta kullanıcıyı şirket bölümüne bırakır", async () => {
    // Şirket kuruldu ama yanıt kimliği taşımıyorsa formda kalmak, kullanıcıyı
    // ikinci bir şirket kurmaya davet ederdi; bölüm girişi üyelik listesinden
    // doğru şirkete dallanıyor.
    successfulFetch({});

    await expect(createCompanyAction(idleFormState, completeForm())).rejects.toThrow(
      redirectTo("/isveren/sirket"),
    );
  });
});

function successfulFetch(data: unknown) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(jsonResponse(201, envelope(data))),
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
