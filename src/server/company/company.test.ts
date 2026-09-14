import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  createCompany,
  getCompany,
  removeCompanyLogo,
  replaceCompanyLogo,
  updateCompany,
} from "./company";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const details = {
  name: "Koala Temizlik",
  email: "bilgi@koala.test",
  phoneNumber: "05001112233",
  taxNumber: "1234567890",
  type: "LIMITED",
  address: {
    countryId: "11111111-1111-4111-8111-111111111111",
    cityId: "22222222-2222-4222-8222-222222222222",
    districtId: "33333333-3333-4333-8333-333333333333",
    components: { neighborhood: "Kaptanpaşa", thoroughfare: "Piyalepaşa", postalCode: "34440" },
    position: { latitude: 41.05, longitude: 28.98, source: "AUTOCOMPLETE_CONFIRMED" as const },
    candidateToken: "aday-kaniti",
  },
};

describe("şirket backend modülü", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.delete("x-real-ip");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("şirketi tek multipart isteğiyle, JSON parçası içerik tipiyle işaretlenmiş olarak kurar", async () => {
    /*
     * `@RequestPart("company")` gövdeyi ancak parçanın kendi `Content-Type`
     * başlığı `application/json` olduğunda çözebiliyor. Düz metin parça
     * gönderilirse Spring parçayı `CreateCompanyRequestDto`'ya
     * dönüştüremez ve istek alan hatası bile taşımayan bir 400'e düşer.
     */
    const fetchMock = successfulFetch({ id: companyId });

    await createCompany(details, null);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/companies");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);

    // Sınırı `fetch` üretiyor; elle yazılan bir `Content-Type` sınırı
    // düşürür ve backend parçaların hiçbirini okuyamaz.
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);

    const part = (init.body as FormData).get("company");
    expect(part).toBeInstanceOf(Blob);
    expect((part as Blob).type).toBe("application/json");
    expect(JSON.parse(await (part as Blob).text())).toEqual(details);
  });

  it("logoyu aynı isteğe ikinci parça olarak ekler", async () => {
    // Logo ayrı bir istekle gitseydi, şirket kurulup logo yüklemesi
    // düştüğünde kullanıcı silinemeyen ve logosuz kalan bir şirketle kalırdı.
    const fetchMock = successfulFetch({ id: companyId });
    const logo = new File(["koala"], "logo.webp", { type: "image/webp" });

    await createCompany(details, logo);

    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData;
    expect(body.get("logo")).toBe(logo);
    // `uploadValidator` desteklenen türü **dosya adının uzantısından**
    // okuyor; adı düşüren bir ekleme her logoyu "desteklenmeyen tür" yapardı.
    expect((body.get("logo") as File).name).toBe("logo.webp");
  });

  it("logo seçilmediğinde parçayı hiç eklemez", async () => {
    // `@RequestPart(value = "logo", required = false)` boş bir parçayı
    // dosya sanar ve `uploadValidator` onu boş dosya diye reddeder.
    const fetchMock = successfulFetch({ id: companyId });

    await createCompany(details, null);

    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData;
    expect(body.has("logo")).toBe(false);
  });

  it("şirketi kendi kanonik ucundan okur", async () => {
    const fetchMock = successfulFetch({ id: companyId });

    await getCompany(companyId);

    expect(requestOf(fetchMock)).toMatchObject({
      url: `https://api.example.test/companies/${companyId}`,
      method: "GET",
    });
  });

  it("güncellemeyi PATCH ile ve yalnız beş alanla gönderir", async () => {
    const fetchMock = successfulFetch({ id: companyId });

    await updateCompany(companyId, {
      name: "Koala",
      email: "bilgi@koala.test",
      phoneNumber: "05001112233",
      website: "",
      description: "",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/companies/${companyId}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Koala",
      email: "bilgi@koala.test",
      phoneNumber: "05001112233",
      website: "",
      description: "",
    });
  });

  it("adresi aynı PATCH ucuna tek başına gönderir ve yanıttaki adresi okur", async () => {
    // 0.9.24 sözleşmesi (is-koala/koala-backend#288): `address` isteğe bağlı,
    // metin alanları gövdede yoksa dokunulmuyor. Yanıt güncel adresi taşır.
    const fetchMock = successfulFetch({
      id: companyId,
      address: {
        countryName: "Türkiye",
        cityName: "İstanbul",
        districtName: "Beyoğlu",
        components: details.address.components,
        displayAddress: "Piyalepaşa, Kaptanpaşa / Beyoğlu",
        needsReview: false,
        position: { latitude: "41.050000", longitude: "28.980000", source: "AUTOCOMPLETE_CONFIRMED" },
      },
    });

    const company = await updateCompany(companyId, { address: details.address });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/companies/${companyId}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ address: details.address });
    expect(company.address).toMatchObject({
      districtName: "Beyoğlu",
      displayAddress: "Piyalepaşa, Kaptanpaşa / Beyoğlu",
      position: { latitude: 41.05, longitude: 28.98 },
    });
  });

  it("logoyu kendi ucuna multipart olarak yazar", async () => {
    // `PUT /companies/{companyId}/logo` parça adını `logo` bekliyor ve
    // şirket güncellemesinden ayrı bir uç: formun kaydetmesine bağlanamaz.
    const fetchMock = successfulFetch({ id: companyId });
    const logo = new File(["koala"], "logo.png", { type: "image/png" });

    await replaceCompanyLogo(companyId, logo);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/companies/${companyId}/logo`);
    expect(init.method).toBe("PUT");
    expect((init.body as FormData).get("logo")).toBe(logo);
  });

  it("logoyu kendi ucundan kaldırır", async () => {
    const fetchMock = successfulFetch({ id: companyId });

    await removeCompanyLogo(companyId);

    expect(requestOf(fetchMock)).toMatchObject({
      url: `https://api.example.test/companies/${companyId}/logo`,
      method: "DELETE",
    });
  });

  it("kimliği yola koymadan önce kaçırır", async () => {
    const fetchMock = successfulFetch({ id: companyId });

    await getCompany("a b/../admin");

    expect(requestOf(fetchMock).url).toBe("https://api.example.test/companies/a%20b%2F..%2Fadmin");
  });
});

function successfulFetch(data: unknown) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(jsonResponse(200, envelope(data))),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestOf(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return { url, method: init.method };
}
