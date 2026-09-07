import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  cancelJob,
  closeJob,
  createCompanyJob,
  createJobApplication,
  fetchJobDetail,
  readJobDetail,
  readMyJobs,
} from "./jobs";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const companyId = "5d3c1b0a-7f60-4c2f-8a9e-9c1f0d244f6c";

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
      status: "OPEN",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/jobs/${jobId}`);
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
    expect(init.headers).toBeInstanceOf(Headers);
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

  it("ilanın kontenjanını ve işe alınan sayısını yayım görünümüne taşır", async () => {
    // İki alan da `JobDetailDto` üzerinde; `headcount` null ise ilan sınırsız
    // kişilik ve sıfır saymak onu doluymuş gibi gösterirdi.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope({
      id: jobId,
      title: "Etkinlik görevlisi",
      status: "OPEN",
      salaryType: "DAILY",
      startDateTime: "2026-10-10T09:00",
      endDateTime: "2026-10-11T18:00",
      headcount: 5,
      hiredCount: 2,
    }))));

    await expect(fetchJobDetail(jobId)).resolves.toMatchObject({
      headcount: 5,
      hiredCount: 2,
    });
  });

  it("kontenjan alanları hiç gelmezse sınırsız ve sıfır sayar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, envelope({
      id: jobId,
      title: "Etkinlik görevlisi",
      status: "OPEN",
      salaryType: "DAILY",
      startDateTime: "2026-10-10T09:00",
      endDateTime: "2026-10-11T18:00",
    }))));

    await expect(fetchJobDetail(jobId)).resolves.toMatchObject({
      headcount: null,
      hiredCount: 0,
    });
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

describe("şirket ilanı ve ilanlarım listesinin BFF sözleşmesi", () => {
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

  it("şirket ilanını şirketin kendi ucuna gönderir; bireysel uca düşmez", async () => {
    // İki uç ayrı davranıyor: bireysel uç sigortayı `false` sabitliyor ve
    // sigorta zorunlu kategoriyi hiç kabul etmiyor.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, envelope({ id: jobId })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createCompanyJob(companyId, companyJobBody())).resolves.toMatchObject({
      id: jobId,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/companies/${companyId}/jobs`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({ insuranceRequired: true });
  });

  it("şirket kimliğini yola koymadan önce kaçırır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, envelope({ id: jobId })));
    vi.stubGlobal("fetch", fetchMock);

    await createCompanyJob("../auth/login", companyJobBody());

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.example.test/companies/..%2Fauth%2Flogin/jobs");
  });

  it("ilanlarımı sayfa ve sıralama parametreleriyle creator bazlı uçtan okur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope(jobPageDto())));
    vi.stubGlobal("fetch", fetchMock);

    const page = await readMyJobs({ page: 2, sort: "title,asc" });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      "https://api.example.test/users/me/jobs?page=2&size=20&sort=title%2Casc",
    );
    expect(page).toMatchObject({ page: 2, totalElements: 41, totalPages: 3, last: false });
    expect(page.content[0]).toEqual({
      id: jobId,
      title: "Etkinlik görevlisi",
      position: "Karşılama",
      companyName: "Koala Etkinlik",
      employerType: "COMPANY",
      status: "OPEN",
      salaryType: "DAILY",
      workerPayout: "1250.00",
      currency: "TRY",
      startsAt: "2026-09-12T09:00:00",
      endsAt: "2026-09-12T18:00:00",
      cityName: "İstanbul",
      districtName: "Kadıköy",
      insuranceRequired: true,
      applicationCount: 7,
      hiredCount: 1,
      headcount: 4,
    });
  });

  it("fiyat anlık görüntüsü olmayan ilanı tutar da ücreti uydurmaz", async () => {
    // `pricing` yalnız snapshot'ı olan ilanlarda dolu; `salary` alanından
    // çalışan ücretini yeniden üretmek, kilitlenen tutarla ayrışabilirdi.
    const dto = jobSummaryDto();
    delete (dto as { pricing?: unknown }).pricing;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, envelope({ ...jobPageDto(), content: [dto] })));
    vi.stubGlobal("fetch", fetchMock);

    const page = await readMyJobs({ page: 0, sort: "createdAt,desc" });

    expect(page.content[0]).toMatchObject({ workerPayout: null, currency: null });
  });

  it("gövdesiz yanıtta boş sayfaya düşer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, httpStatus: "OK", message: "İlanlar listelendi" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readMyJobs({ page: 0, sort: "createdAt,desc" })).resolves.toMatchObject({
      content: [],
      totalElements: 0,
    });
  });
});

function companyJobBody() {
  return {
    categoryId: "9f0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f02",
    title: "Motorlu kurye",
    description: "Hafta sonu paket dağıtımı.",
    position: "Kurye",
    address: { candidateToken: "aday-token-yer-tutucu" },
    type: "ONE_TIME",
    salaryType: "DAILY",
    salary: "1500.00",
    startDateTime: "2026-10-10T09:00",
    endDateTime: "2026-10-11T18:00",
    minAge: 18,
    maxAge: 45,
    experienceRequired: false,
    insuranceRequired: true,
  } as never;
}

function jobPageDto() {
  return {
    content: [jobSummaryDto()],
    page: 2,
    size: 20,
    totalElements: 41,
    totalPages: 3,
    first: false,
    last: false,
  };
}

function jobSummaryDto() {
  return {
    id: jobId,
    title: "Etkinlik görevlisi",
    position: "Karşılama",
    sector: "Etkinlik",
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
    cityName: "İstanbul",
    districtName: "Kadıköy",
    companyName: "Koala Etkinlik",
    applicationCount: 7,
    headcount: 4,
    hiredCount: 1,
  };
}

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
