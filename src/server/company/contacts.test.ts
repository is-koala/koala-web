import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import { getCompanyContacts, getCompanyInvitations, removeCompanyContact } from "./contacts";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "11111111-1111-4111-8111-111111111111";

describe("şirket yetkilileri backend modülü", () => {
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

  it("yetkilileri şirkete bağlı kanonik uçtan okur", async () => {
    const fetchMock = successfulFetch([]);

    await getCompanyContacts(companyId);

    expect(requestOf(fetchMock)).toMatchObject({
      url: `https://api.example.test/companies/${companyId}/contacts`,
      method: "GET",
    });
  });

  it("bekleyen davetleri şirketin kendi davet ucundan okur", async () => {
    // Uç düzeltmeden önce platform yöneticisine kilitliydi ve şirket
    // yöneticisi kendi gönderdiği daveti göremiyordu (is-koala/koala-backend#85).
    const fetchMock = successfulFetch([]);

    await getCompanyInvitations(companyId);

    expect(requestOf(fetchMock)).toMatchObject({
      url: `https://api.example.test/companies/${companyId}/contact-invitations`,
      method: "GET",
    });
  });

  it("yetkiliyi üyelik kaydının değil kişinin kimliğiyle çıkarır", async () => {
    // `DELETE /companies/{companyId}/contacts/{userId}` kişinin kimliğini
    // bekliyor; `CompanyContactDto.id` üyelik kaydınınki ve onu göndermek
    // her çıkarmayı 404'e düşürürdü.
    const fetchMock = successfulFetch(null);

    await removeCompanyContact(companyId, userId);

    expect(requestOf(fetchMock)).toMatchObject({
      url: `https://api.example.test/companies/${companyId}/contacts/${userId}`,
      method: "DELETE",
    });
  });

  it("adres parçalarını yola koymadan önce kaçırır", async () => {
    // Kimlikler adres çubuğundan geliyor; kaçırılmadan birleştirilen bir
    // değer yolu değiştirebilir.
    const fetchMock = successfulFetch(null);

    await removeCompanyContact("a b/../admin", "c d");

    expect(requestOf(fetchMock).url).toBe(
      "https://api.example.test/companies/a%20b%2F..%2Fadmin/contacts/c%20d",
    );
  });

  it("gövdesiz yanıtta listeyi boş kabul eder", async () => {
    // `apiFetch` gövdesiz başarılı yanıtı `null` döndürüyor; çağıran taraf
    // `null.map` ile patlamak yerine boş liste görmeli.
    successfulFetch(null);

    expect(await getCompanyContacts(companyId)).toEqual([]);
    expect(await getCompanyInvitations(companyId)).toEqual([]);
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
  return { url, method: init.method, body: init.body };
}
