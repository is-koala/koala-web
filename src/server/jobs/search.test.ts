import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseJobSearchParams } from "@/jobs/search";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import { readJobFilterOptions, searchJobs } from "./search";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const cityId = "5d3c1b0a-7f60-4c2f-8a9e-9c1f0d244f6c";
const countryId = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

function requestOf(fetchMock: ReturnType<typeof vi.fn>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url: new URL(url), init, headers: new Headers(init.headers) };
}

describe("herkese açık ilan aramasının BFF sözleşmesi", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    requestHeaders.delete("x-real-ip");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("süzgeci, sayfayı ve sıralamayı sunucunun alan adlarıyla gönderir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(pageDto())));
    vi.stubGlobal("fetch", fetchMock);

    await searchJobs(parseJobSearchParams({ ara: "garson", il: cityId, sayfa: "2" }));

    const { url } = requestOf(fetchMock);
    expect(url.pathname).toBe("/jobs");
    expect(url.searchParams.get("query")).toBe("garson");
    expect(url.searchParams.get("cityId")).toBe(cityId);
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("size")).toBe("20");
    expect(url.searchParams.get("sort")).toBe("createdAt,desc");
  });

  it("oturum tokenı taşımaz ve yanıtı önbelleğe almaz", async () => {
    // Liste herkese açık: oturum taşırsa `JobAddressVisibility` kesinliği
    // bakan kişiye göre seçer ve aynı liste iki ziyaretçide farklı adres
    // kesinliği taşır. Önbellek de yok — sunucu yalnız `OPEN` ilan döndürüyor,
    // bayat bir sayfa kapanmış ilanı açıkmış gibi gösterirdi.
    cookieStore.values.set("koala_at", "erisim-tokeni");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(pageDto())));
    vi.stubGlobal("fetch", fetchMock);

    await searchJobs(parseJobSearchParams({}));

    const { init, headers } = requestOf(fetchMock);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("X-Client-Platform")).toBe("web");
    expect(init.cache).toBe("no-store");
  });

  it("`JobSummaryDto` alanlarını, adres kesinliğini ve donmuş fiyatı koruyarak okur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(pageDto())));
    vi.stubGlobal("fetch", fetchMock);

    const page = await searchJobs(parseJobSearchParams({}));

    expect(page.totalElements).toBe(1);
    expect(page.content[0]).toEqual({
      id: jobId,
      title: "Etkinlik görevlisi",
      position: "Karşılama",
      sector: "Etkinlik",
      categoryId: "7f60aa11-4c2f-4f6c-8a9e-9c1f0d244f6c",
      categoryName: "Garsonluk",
      categoryCode: "WAITER",
      employerType: "COMPANY",
      type: "ONE_TIME",
      salaryType: "DAILY",
      salary: "1250",
      workerPayout: "1250.00",
      currency: "TRY",
      insuranceRequired: true,
      experienceRequired: false,
      startsAt: "2026-09-12T09:00:00",
      endsAt: "2026-09-12T18:00:00",
      status: "OPEN",
      cityName: "İstanbul",
      districtName: "Kadıköy",
      companyName: "Koala Etkinlik",
      coverImageUrl: "https://cdn.example.test/kapak.jpg",
      applicationCount: 4,
      headcount: 3,
      hiredCount: 1,
      latitude: 40.99,
      longitude: 29.03,
      addressPrecision: "APPROXIMATE",
    });
  });

  it("okunamayan adres kesinliğini kesin saymaz", () => {
    // ADR-0003: bilinmeyen bir bayrağı "kesin" saymak, gizlenmek üzere
    // bulanıklaştırılmış bir adresi açığa çıkarırdı.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope(pageDto({ addressPrecision: "BLOCK_LEVEL" }))),
    );
    vi.stubGlobal("fetch", fetchMock);

    return expect(
      searchJobs(parseJobSearchParams({})).then((page) => page.content[0].addressPrecision),
    ).resolves.toBe("UNKNOWN");
  });

  it("boş `content` dizisini hataya çevirmez", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, envelope({ content: [], totalElements: 0 })));
    vi.stubGlobal("fetch", fetchMock);

    const page = await searchJobs(parseJobSearchParams({ sayfa: "5" }));

    expect(page.content).toEqual([]);
    expect(page.totalElements).toBe(0);
  });

  it("sunucunun 400'ünü yutmaz; çağıran hata durumunu çizebilsin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        success: false,
        errorCode: "PAGE_SORT_FIELD_NOT_ALLOWED",
        errorCategory: "VALIDATION",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchJobs(parseJobSearchParams({}))).rejects.toMatchObject({
      status: 400,
      errorCode: "PAGE_SORT_FIELD_NOT_ALLOWED",
    });
  });
});

describe("süzgeç sözlükleri", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("illeri Türkiye'nin ülke kimliğinden geçerek okur ve önbellekler", async () => {
    // `GET /reference/cities` diye bir uç yok: iller yalnız bir ülkenin
    // altında duruyor, yani önce ülke listesinden ISO kodu aranıyor.
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      void init;
      if (url.endsWith("/reference/countries")) {
        return jsonResponse(200, envelope([{ id: countryId, name: "Türkiye", code: "TR" }]));
      }
      if (url.endsWith(`/reference/countries/${countryId}/cities`)) {
        return jsonResponse(200, envelope([{ id: cityId, name: "İstanbul" }]));
      }
      return jsonResponse(200, envelope([]));
    });
    vi.stubGlobal("fetch", fetchMock);

    const options = await readJobFilterOptions(null);

    expect(options.cities).toEqual([{ id: cityId, name: "İstanbul" }]);
    expect(options.districts).toEqual([]);
    expect(fetchMock.mock.calls.every(([, init]) => init.cache === "force-cache")).toBe(true);
  });

  it("il seçilmeden ilçe listesini hiç istemez", async () => {
    // Her çağrıya yeni bir `Response`: gövde bir kez okunabiliyor.
    const fetchMock = vi.fn(async (url: string) => {
      void url;
      return jsonResponse(200, envelope([]));
    });
    vi.stubGlobal("fetch", fetchMock);

    await readJobFilterOptions(null);

    const paths = fetchMock.mock.calls.map(([url]) => new URL(url).pathname);
    expect(paths.some((path) => path.includes("/districts"))).toBe(false);
  });

  it("il seçiliyken o ilin ilçelerini ister", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/reference/countries")) {
        return jsonResponse(200, envelope([{ id: countryId, name: "Türkiye", code: "TR" }]));
      }
      if (url.endsWith(`/reference/cities/${cityId}/districts`)) {
        return jsonResponse(200, envelope([{ id: jobId, name: "Kadıköy" }]));
      }
      return jsonResponse(200, envelope([]));
    });
    vi.stubGlobal("fetch", fetchMock);

    const options = await readJobFilterOptions(cityId);

    expect(options.districts).toEqual([{ id: jobId, name: "Kadıköy" }]);
  });
});

function pageDto(overrides: Record<string, unknown> = {}) {
  return {
    content: [
      {
        id: jobId,
        title: "Etkinlik görevlisi",
        position: "Karşılama",
        sector: "Etkinlik",
        category: { id: "7f60aa11-4c2f-4f6c-8a9e-9c1f0d244f6c", name: "Garsonluk", code: "WAITER" },
        employerType: "COMPANY",
        type: "ONE_TIME",
        salaryType: "DAILY",
        salary: 1250,
        pricing: { workerPayout: "1250.00", currency: "TRY" },
        insuranceRequired: true,
        experienceRequired: false,
        startDateTime: "2026-09-12T09:00:00",
        endDateTime: "2026-09-12T18:00:00",
        status: "OPEN",
        cityName: "İstanbul",
        districtName: "Kadıköy",
        companyName: "Koala Etkinlik",
        coverImageUrl: "https://cdn.example.test/kapak.jpg",
        applicationCount: 4,
        headcount: 3,
        hiredCount: 1,
        latitude: 40.99,
        longitude: 29.03,
        addressPrecision: "APPROXIMATE",
        ...overrides,
      },
    ],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
  };
}
