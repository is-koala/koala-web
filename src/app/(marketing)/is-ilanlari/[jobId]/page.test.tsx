import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JobDetailState } from "@/components/job-detail-state";
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

  it("404 hata durumunu backend mesajı olmadan sunar", () => {
    render(
      <JobDetailState state={{ status: "error", errorCode: "JOB_NOT_FOUND", httpStatus: 404 }} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("İçerik bulunamadı");
  });

  it("beklenmedik hata durumunu nötr metinle sunar", () => {
    render(
      <JobDetailState state={{ status: "error", errorCode: "UNEXPECTED", httpStatus: 500 }} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Bir sorun oluştu");
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
