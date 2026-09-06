import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders as testRequestHeaders,
} from "../../../tests/support/session-cookies";

import {
  citiesRoute,
  countriesRoute,
  districtsRoute,
  resolveRoute,
  reverseRoute,
  startSessionRoute,
  suggestionsRoute,
} from "./routes";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const sessionId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const candidateId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const countryId = "2f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f52";
const cityId = "6f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f50";

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

const candidateEnvelope = envelope({
  countryId: "2f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f52",
  countryName: "Türkiye",
  countryCode: "TR",
  cityId: "6f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f50",
  cityName: "İstanbul",
  districtId: "1f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f51",
  districtName: "Beşiktaş",
  components: { neighborhood: "Levent", thoroughfare: "Büyükdere Caddesi", postalCode: "34330" },
  position: { latitude: 41.081235, longitude: 29.008765, source: "AUTOCOMPLETE_CONFIRMED" },
  candidateToken: "aday-token-yer-tutucu",
  needsUserReview: false,
  attribution: "Google Maps",
});

function providerDown() {
  return jsonResponse(502, {
    success: false,
    httpStatus: "BAD_GATEWAY",
    errorCode: "ADDRESS_SEARCHPROVIDER_UNAVAILABLE",
    errorCategory: "EXTERNAL_SERVICE",
    message: "The address search provider is currently unavailable.",
  });
}

function stubFetch(...responses: Response[]) {
  // Çağrı listesi tiplensin diye imza verilir; gövde argümanları okumuyor.
  const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
    async () => responses.shift() ?? jsonResponse(200, envelope(null)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function signIn() {
  cookieStore.values.clear();
  cookieStore.values.set("koala_did", deviceId);
  cookieStore.values.set("koala_at", "access-placeholder");
  cookieStore.values.set("koala_rt", "refresh-placeholder");
}

function jsonRequest(body: unknown) {
  return new Request("https://iskoala.com/api/address/candidates/reverse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("adres ağ geçidi BFF uçları", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    testRequestHeaders.delete("x-real-ip");
    signIn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("arama oturumunu açar ve backend adresini tarayıcıya sızdırmaz", async () => {
    const fetchMock = stubFetch(
      jsonResponse(201, envelope({ id: sessionId, expiresAt: "2026-09-06T12:00:00Z" })),
    );

    const response = await startSessionRoute();

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/locations/address-search-sessions",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      id: sessionId,
      expiresAt: "2026-09-06T12:00:00Z",
    });
  });

  it("oturumsuz çağrıyı backend'e hiç sormadan reddeder", async () => {
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    const fetchMock = stubFetch();

    const response = await startSessionRoute();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "AUTHENTICATION_REQUIRED",
      httpStatus: 401,
    });
  });

  it("öneri sorgusunu oturum kimliğiyle backend'e taşır", async () => {
    const fetchMock = stubFetch(
      jsonResponse(200, envelope([{ id: candidateId, mainText: "Levent", secondaryText: "Beşiktaş" }])),
    );

    const response = await suggestionsRoute(searchFor("büyükdere cad"), sessionId);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/locations/address-search-sessions/${sessionId}/suggestions?query=b%C3%BCy%C3%BCkdere+cad`,
    );
    await expect(response.json()).resolves.toEqual([
      { id: candidateId, mainText: "Levent", secondaryText: "Beşiktaş" },
    ]);
  });

  it("kimlik yerine yol parçası taşıyan isteği backend'e hiç iletmez", async () => {
    const fetchMock = stubFetch();

    const response = await suggestionsRoute(searchFor("levent"), "../../auth/login");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADDRESS_SEARCHSESSION_INVALID",
      httpStatus: 400,
    });
  });

  it("üç karakterden kısa sorguyu sağlayıcıya hiç sormaz", async () => {
    const fetchMock = stubFetch();

    const response = await suggestionsRoute(searchFor("le"), sessionId);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADDRESS_SEARCHQUERY_INVALID",
      httpStatus: 400,
    });
  });

  it("sağlayıcı hatasını kodla iletir, backend metnini iletmez", async () => {
    stubFetch(providerDown());

    const response = await suggestionsRoute(searchFor("levent"), sessionId);
    const body = await response.text();

    expect(response.status).toBe(502);
    expect(JSON.parse(body)).toEqual({
      errorCode: "ADDRESS_SEARCHPROVIDER_UNAVAILABLE",
      httpStatus: 502,
    });
    expect(body).not.toContain("provider is currently unavailable");
  });

  it("adayı çözümleyip tek kullanımlık kanıtı geri verir", async () => {
    const fetchMock = stubFetch(jsonResponse(200, candidateEnvelope));

    const response = await resolveRoute(sessionId, candidateId);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.example.test/locations/address-search-sessions/${sessionId}/candidates/${candidateId}/resolve`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    await expect(response.json()).resolves.toMatchObject({
      candidateToken: "aday-token-yer-tutucu",
      needsUserReview: false,
      attribution: "Google Maps",
    });
  });

  it("aday kimliği UUID değilse backend'e hiç gitmez", async () => {
    const fetchMock = stubFetch();

    const response = await resolveRoute(sessionId, "..%2F..%2Fauth");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADDRESS_SEARCHCANDIDATE_INVALID",
      httpStatus: 400,
    });
  });

  it("ters çözümlemede konumu altı ondalığa yuvarlayarak gönderir", async () => {
    const fetchMock = stubFetch(jsonResponse(200, candidateEnvelope));

    await reverseRoute(jsonRequest({ latitude: 41.0812345678, longitude: 29.0087654321 }));

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/locations/address-candidates/reverse",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      latitude: 41.081235,
      longitude: 29.008765,
    });
  });

  it("hizmet alanı dışındaki pini sağlayıcıya hiç sormadan reddeder", async () => {
    const fetchMock = stubFetch();

    const response = await reverseRoute(jsonRequest({ latitude: 39.92077, longitude: 32.85411 }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADDRESS_SEARCHCANDIDATE_OUTSIDESERVICEAREA",
      httpStatus: 400,
    });
  });

  it("okunamayan konum gövdesini doğrulama hatası olarak bildirir", async () => {
    // "Adres bulunamadı" demek yanlış olurdu: sağlayıcıya hiç sorulmadı.
    stubFetch();

    const response = await reverseRoute(jsonRequest({ latitude: "41", longitude: null }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
    });
  });

  it("elle seçim yedeği için ülke, il ve ilçe listelerini oturumsuz da verir", async () => {
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    const fetchMock = stubFetch(
      jsonResponse(200, envelope([{ id: "1", name: "Türkiye", code: "TR" }])),
      jsonResponse(200, envelope([{ id: "2", name: "İstanbul" }])),
      jsonResponse(200, envelope([{ id: "3", name: "Beşiktaş" }])),
    );

    await expect((await countriesRoute()).json()).resolves.toEqual([
      { id: "1", name: "Türkiye", code: "TR" },
    ]);
    await expect((await citiesRoute(countryId)).json()).resolves.toEqual([
      { id: "2", name: "İstanbul" },
    ]);
    await expect((await districtsRoute(cityId)).json()).resolves.toEqual([
      { id: "3", name: "Beşiktaş" },
    ]);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://api.example.test/reference/countries",
      `https://api.example.test/reference/countries/${countryId}/cities`,
      `https://api.example.test/reference/cities/${cityId}/districts`,
    ]);
  });
});

function searchFor(query: string) {
  return new Request(
    `https://iskoala.com/api/address/search-sessions/x/suggestions?query=${encodeURIComponent(query)}`,
  );
}
