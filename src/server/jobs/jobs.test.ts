import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import { cancelJob, closeJob, createJobApplication, readJobDetail } from "./jobs";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

describe("ilan ayrıntısı ve başvuru BFF sözleşmesi", () => {
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
      employerName: "Ayşe Yıldız",
      salaryType: "DAILY",
      startsAt: "2026-09-12T09:00:00",
      endsAt: "2026-09-12T18:00:00",
      workerPayout: "1250.00",
      currency: "TRY",
      insuranceRequired: true,
      experienceRequired: false,
      location: "Kadıköy, İstanbul",
      addressPrecision: "APPROXIMATE",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/jobs/${jobId}`);
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
    expect(init.headers).toBeInstanceOf(Headers);
  });

  it("başvuru gövdesinde yalnız dolu notu taşır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, envelope({ id: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createJobApplication(jobId, "Vardiyaya uygunum.")).resolves.toEqual({
      id: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/jobs/${jobId}/applications`);
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ notes: "Vardiyaya uygunum." }),
    });
  });

  it("not yoksa opsiyonel alanı boş değerle uydurmaz", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, envelope({ id: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createJobApplication(jobId);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({}));
  });

  it("kapatmayı ilanın kendi POST ucuna, gövdesiz gönderir", async () => {
    // `SuccessResult` veri taşımıyor; zarfın `data` alanı yok ve çağıran
    // bunu bir değer sanmamalı.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, httpStatus: "OK", message: "İlan kapatıldı" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(closeJob(jobId)).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/jobs/${jobId}/close`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });

  it("iptali ayrı POST ucuna gönderir; kapatmayla aynı yola düşmez", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, httpStatus: "OK", message: "İlan iptal edildi" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await cancelJob(jobId);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/jobs/${jobId}/cancel`);
    expect(init.method).toBe("POST");
  });

  it("kimliği yola koymadan önce kaçırır", async () => {
    // Kimlik tarayıcıdan geliyor; action UUID doğrulaması yapıyor ama yol
    // birleştirmesi kendi başına da güvenli olmalı.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, httpStatus: "OK" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await closeJob("../auth/login");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.example.test/jobs/..%2Fauth%2Flogin/close");
  });
});

function jobDetailDto() {
  return {
    id: jobId,
    title: "Etkinlik görevlisi",
    description: "Festival alanında misafir karşılama.",
    duties: "Bilet kontrolü ve yönlendirme",
    dressCode: "Siyah kıyafet",
    position: "Karşılama",
    category: { id: "category-1", name: "Etkinlik", code: "EVENT" },
    employerType: "COMPANY",
    type: "ONE_TIME",
    salaryType: "DAILY",
    salary: 1500,
    pricing: {
      pricingVersion: "2026-09",
      currency: "TRY",
      workerPayout: "1250.00",
      serviceFeeRate: "0.20",
      serviceFeeAmount: "250.00",
      employerTotal: "1500.00",
    },
    insuranceRequired: true,
    experienceRequired: false,
    startDateTime: "2026-09-12T09:00:00",
    endDateTime: "2026-09-12T18:00:00",
    status: "OPEN",
    address: { displayAddress: "Kadıköy, İstanbul" },
    addressPrecision: "APPROXIMATE",
    creator: { firstName: "Ayşe", lastName: "Yıldız" },
    company: { name: "Koala Etkinlik" },
    headcount: 4,
    hiredCount: 1,
  };
}
