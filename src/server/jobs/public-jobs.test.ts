import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";
import {
  forbiddenAddressValues,
  jobDetailDto,
} from "../../../tests/support/job-detail";

import { readJobDetail, readOpenJobIds } from "./public-jobs";

const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";

/**
 * Çerez ve başlık taklidi bilerek **duruyor**, oysa bu modül ikisini de
 * okumamalı. Taklit olmasaydı `next/headers` testte atardı ve bir çerez
 * okuması sızdığında iddia "modül patladı" diye kırmızıya dönerdi — doğru
 * sonuç, yanlış sebep. Burada çerezler dolu ve okunmadıkları ölçülüyor.
 */
vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

describe("herkese açık ilan okumasının BFF sözleşmesi", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e");
    requestHeaders.delete("x-real-ip");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("ilanı sunucu sözleşmesinden, adres kesinliğini ve fiyat anlık görüntüsünü koruyarak okur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope(jobDetailDto())),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readJobDetail(jobId)).resolves.toEqual({
      id: jobId,
      title: "Etkinlik görevlisi",
      description: "Festival alanında misafir karşılama.",
      duties: "Bilet kontrolü ve yönlendirme",
      dressCode: "Siyah kıyafet",
      categoryName: "Etkinlik",
      companyName: "Koala Etkinlik",
      companyLogoUrl: "https://cdn.example.test/logo.png",
      employerName: "Ayşe Yıldız",
      type: "ONE_TIME",
      salaryType: "DAILY",
      startsAt: "2026-09-12T09:00:00",
      endsAt: "2026-09-12T18:00:00",
      createdAt: "2026-08-30T07:15:00Z",
      pricing: {
        pricingVersion: "2026-09",
        currency: "TRY",
        workerPayout: "1250.00",
        serviceFeeRate: "0.20",
        serviceFeeAmount: "250.00",
        employerTotal: "1500.00",
      },
      minAge: 18,
      maxAge: 45,
      insuranceRequired: true,
      experienceRequired: false,
      headcount: 4,
      hiredCount: 1,
      images: [{ url: "https://cdn.example.test/kapak.jpg", caption: "Sahne", cover: true }],
      cityName: "İstanbul",
      districtName: "Kadıköy",
      addressPrecision: "EXACT",
      status: "OPEN",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/jobs/${jobId}`);
    expect(init).toMatchObject({ method: "GET", cache: "force-cache" });
    expect(init.headers).toBeInstanceOf(Headers);
  });

  it("EXACT adresli yanıtta sokak, bina ve koordinatı modele hiç almaz", async () => {
    /*
     * ADR-0003'ün istemci tarafındaki tek koruması bu satırlar. Fikstür
     * `EXACT` — yani `JobAddressVisibility.protect` gövdeyi **maskelemedi** —
     * ve tam sokak adresi, posta kodu ile tam hassasiyetli koordinat taşıyor.
     * `GET /jobs/{jobId}` kimlik istemediği için anonim ziyaretçi bu gövdeyi
     * gerçekten alabiliyor.
     *
     * İddia serileştirilmiş model üzerinde: bir alanın adını tek tek saymak,
     * çeviriciye eklenen **yeni** bir sızıntıyı kaçırırdı.
     */
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, envelope(jobDetailDto()))),
    );

    const job = await readJobDetail(jobId);
    const serialized = JSON.stringify(job);

    for (const secret of forbiddenAddressValues) {
      expect(serialized, secret).not.toContain(secret);
    }
    expect(job).toMatchObject({ cityName: "İstanbul", districtName: "Kadıköy" });
  });

  it("ilanı oturum taşımadan, çerez ve istemci IP'si okumadan çeker", async () => {
    /*
     * Üç sonucu birden tutuyor: bayat çerezli ziyaretçi `/giris`'e
     * düşmüyor, yanıt `viewerId`'ye göre `EXACT`e dönmüyor, ve sayfa
     * istek-zamanı API'si okumadığı için ISR ile üretilebiliyor. Çereze bir
     * kimlik yazılmış olmasına rağmen isteğe girmemesi ölçülüyor.
     */
    cookieStore.values.set("koala_at", "erisim-tokeni");
    requestHeaders.set("x-real-ip", "203.0.113.9");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope(jobDetailDto())),
    );
    vi.stubGlobal("fetch", fetchMock);

    await readJobDetail(jobId);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("X-Forwarded-For")).toBeNull();
    expect(headers.get("X-Device-Id")).toBe("web-public-reader");
  });

  it("ilanın durumunu başvuru yüzeyine taşır", async () => {
    // Başvuru formunun çizilip çizilmeyeceğine ilanın durumu karar veriyor;
    // alan modele girmezse kapatılmış ilan da başvuru almaya devam eder.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope({ ...jobDetailDto(), status: "CANCELLED" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readJobDetail(jobId)).resolves.toMatchObject({ status: "CANCELLED" });
  });

  it("durum alanı hiç gelmezse ilanı kapalı saymaz", async () => {
    const dto = jobDetailDto();
    delete (dto as { status?: unknown }).status;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(dto)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readJobDetail(jobId)).resolves.toMatchObject({ status: "UNKNOWN" });
  });

  it("site haritası için açık ilanları sayfa sayfa, sunucunun süzgecine güvenerek toplar", async () => {
    // `GET /jobs` zaten yalnız `OPEN` ilanları döndürüyor
    // (`JobManager.search`); istemci o süzgeci tekrar etmiyor.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, envelope({ content: [{ id: "ilan-1" }, { id: "ilan-2" }], last: false })),
      )
      .mockResolvedValueOnce(jsonResponse(200, envelope({ content: [{ id: "ilan-3" }], last: true })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readOpenJobIds()).resolves.toEqual(["ilan-1", "ilan-2", "ilan-3"]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl] = fetchMock.mock.calls[0] as [string];
    const [secondUrl] = fetchMock.mock.calls[1] as [string];
    expect(firstUrl).toContain("page=0&size=100");
    expect(secondUrl).toContain("page=1&size=100");
  });

  it("son sayfaya gelince sayfalamayı durdurur", async () => {
    // Sınırsız bir döngü build süresini backend'in ilan sayısına bağlardı;
    // `last` doğruyken bir tur daha atmak o riski geri getirir.
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, envelope({ content: [{ id: "ilan-1" }], last: true })));
    vi.stubGlobal("fetch", fetchMock);

    await readOpenJobIds();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
