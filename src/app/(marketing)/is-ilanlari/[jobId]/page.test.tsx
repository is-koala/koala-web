import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";
import { readJobDetail } from "@/server/jobs/public-jobs";

import { jobDetailFixture, jobDetailId } from "../../../../../tests/support/job-detail";

import Page, { generateMetadata } from "./page";

vi.mock("@/server/jobs/public-jobs", () => ({ readJobDetail: vi.fn() }));
vi.mock("./actions", () => ({ applyToJobAction: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const jobId = jobDetailId;
const job = jobDetailFixture();
const params = (id: string = jobId) => Promise.resolve({ jobId: id });

/** Kanonik adres ve JSON-LD `url` alanı ortam değişkeninden kuruluyor. */
function stubSiteEnvironment() {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://iskoala.com");
  vi.stubEnv("NEXT_PUBLIC_APP_URL_SCHEME", "koala");
}

/** `apiFetch`'in backend hatasında attığı şey; sayfa yalnız `status`'ü okuyor. */
function apiFailure(status: number, errorCode: string): ApiError {
  return new ApiError({ status, errorCode, errorCategory: "UNEXPECTED", message: "" });
}

describe("ilan ayrıntısı sayfası", () => {
  beforeEach(() => {
    vi.mocked(readJobDetail).mockReset();
    stubSiteEnvironment();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("geçerli ilanın ayrıntısını çizer", async () => {
    vi.mocked(readJobDetail).mockResolvedValue(job);

    render(await Page({ params: params() }));

    expect(screen.getByRole("heading", { name: job.title })).toBeVisible();
    expect(readJobDetail).toHaveBeenCalledWith(jobId);
  });

  it("boş GET yanıtını 404'e çevirir", async () => {
    /*
     * Sayfa kendi "bulunamadı" kartını 200 ile çizmiyor. Yanındaki
     * `loading.tsx` kaldırılmadan bu mümkün değildi: Suspense sınırı kabuğu
     * erken akıtıyor ve HTTP durumunu 200'de kilitliyordu
     * (`AGENTS.md` § "Yapı", is-koala/koala-web#94).
     */
    vi.mocked(readJobDetail).mockResolvedValue(null);

    await expect(Page({ params: params() })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("geçersiz ilan kimliği için backend'e gitmeden 404 döner", async () => {
    await expect(Page({ params: params("not-a-job") })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(readJobDetail).not.toHaveBeenCalled();
  });

  it("backend 404'ünü notFound()'a çevirir", async () => {
    // Kalıcı yokluk: cevap beş dakika sonra da aynı olacak, yani 404 yanıtının
    // önbelleğe girmesi doğru.
    vi.mocked(readJobDetail).mockRejectedValue(apiFailure(404, "JOB_NOT_FOUND"));

    await expect(Page({ params: params() })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each([
    ["503 geçici arıza", 503, "SERVICE_UNAVAILABLE"],
    ["500 beklenmedik hata", 500, "UNEXPECTED"],
  ])("%s önbelleğe girmesin diye yeniden atılıyor", async (_name, status, code) => {
    /*
     * Bu testin ölçtüğü şey bir ekran değil, bir **önbellek** kararı.
     *
     * Sayfa `revalidate = 300` ile üretiliyor. Geçici bir arızayı yakalayıp
     * kendi hata kartıyla çizmek yanıtı 200 yapıyordu ve `s-maxage=300` onu
     * beş dakika kilitliyordu: backend iyileşse bile ziyaretçi hata kartını
     * almaya devam ediyor, istek backend'e hiç gitmiyordu. Next'in ISR
     * rehberi bunun için hatanın atılmasını söylüyor — atılan render
     * önbelleğe yazılmıyor ve bir sonraki istek yeniden deniyor.
     *
     * İddia `ApiError` tipini arıyor, çünkü `notFound()` bu dosyada düz bir
     * `Error("NEXT_NOT_FOUND")` atıyor: tip, hatanın 404'e çevrilmediğini de
     * söylüyor. 404'e çevrilen bir 503 yanıtı yeniden beş dakikalık
     * önbelleğe sokardı.
     */
    vi.mocked(readJobDetail).mockRejectedValue(apiFailure(status, code));

    await expect(Page({ params: params() })).rejects.toThrow(ApiError);
  });
});

describe("ilan ayrıntısı yapısal verisi", () => {
  beforeEach(() => {
    vi.mocked(readJobDetail).mockReset();
    stubSiteEnvironment();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("yayındaki ilanda JobPosting yazar", async () => {
    vi.mocked(readJobDetail).mockResolvedValue(job);

    const { container } = render(await Page({ params: params() }));
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script).not.toBeNull();
    expect(JSON.parse(script?.innerHTML ?? "{}")).toMatchObject({
      "@type": "JobPosting",
      title: job.title,
    });
  });

  it("yapısal verinin url'i ile canonical aynı adres", async () => {
    /*
     * İki kol aynı ilanın mutlak adresini yayımlıyor — `<link rel=canonical>`
     * ve JSON-LD `url` — ve daha önce ikisini ayrı ayrı kuran iki satır
     * vardı. Ayrışma sessizdi: derleyici görmüyordu, hiçbir test
     * karşılaştırmıyordu, arama motoru ise iki farklı adres okuyup kanonik
     * seçimini kendi yapıyordu. İkisi artık `absoluteUrl`'den geliyor ve
     * bu iddia onların ayrılmasını yakalıyor.
     */
    vi.mocked(readJobDetail).mockResolvedValue(job);

    const { container } = render(await Page({ params: params() }));
    const script = container.querySelector('script[type="application/ld+json"]');
    const jsonLd = JSON.parse(script?.innerHTML ?? "{}") as { url?: string };
    const metadata = await generateMetadata({ params: params() });

    expect(jsonLd.url).toBe(metadata.alternates?.canonical);
    expect(jsonLd.url).toBe(`https://iskoala.com/is-ilanlari/${jobId}`);
  });

  it("kapatılmış ilanda yapısal veriyi hiç yazmaz", async () => {
    vi.mocked(readJobDetail).mockResolvedValue(jobDetailFixture({ status: "CLOSED" }));

    const { container } = render(await Page({ params: params() }));

    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});

describe("ilan ayrıntısı metadata'sı", () => {
  beforeEach(() => {
    vi.mocked(readJobDetail).mockReset();
    stubSiteEnvironment();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("başlığa ilçe ve ili, canonical'a mutlak adresi yazar", async () => {
    vi.mocked(readJobDetail).mockResolvedValue(job);

    const metadata = await generateMetadata({ params: params() });

    expect(metadata.title).toBe("Etkinlik görevlisi — Kadıköy, İstanbul");
    expect(metadata.alternates?.canonical).toBe(
      `https://iskoala.com/is-ilanlari/${jobId}`,
    );
    expect(metadata.description).toBe("Festival alanında misafirleri karşıla.");
  });

  it("uzun açıklamayı kelime ortasından kesmeden kısaltır", async () => {
    const description = `${"kelime ".repeat(40)}son`;
    vi.mocked(readJobDetail).mockResolvedValue(jobDetailFixture({ description }));

    const metadata = await generateMetadata({ params: params() });

    expect(String(metadata.description).length).toBeLessThanOrEqual(156);
    expect(metadata.description).toMatch(/…$/);
    expect(metadata.description).not.toMatch(/keli…$/);
  });

  it("kapanmış ilanı indeksten düşürür", async () => {
    vi.mocked(readJobDetail).mockResolvedValue(jobDetailFixture({ status: "CLOSED" }));

    const metadata = await generateMetadata({ params: params() });

    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("yayındaki ilanda robots kısıtı yazmaz", async () => {
    vi.mocked(readJobDetail).mockResolvedValue(job);

    const metadata = await generateMetadata({ params: params() });

    expect(metadata.robots).toBeUndefined();
  });

  it("kapak görselini og:image olarak bildirir", async () => {
    vi.mocked(readJobDetail).mockResolvedValue(
      jobDetailFixture({
        images: [
          { url: "https://cdn.example.com/ikinci.jpg", caption: null, cover: false },
          { url: "https://cdn.example.com/kapak.jpg", caption: null, cover: true },
        ],
      }),
    );

    const metadata = await generateMetadata({ params: params() });

    expect(metadata.openGraph?.images).toEqual([{ url: "https://cdn.example.com/kapak.jpg" }]);
  });

  it("okunamayan ilanda başlık uydurmaz ve indekslemeyi kapatır", async () => {
    vi.mocked(readJobDetail).mockResolvedValue(null);

    const metadata = await generateMetadata({ params: params() });

    expect(metadata.title).toBe("İlan bulunamadı");
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
