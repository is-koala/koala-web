import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import Page from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const fetchJobDetail = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

const jobLifecycleActions = vi.hoisted(() =>
  vi.fn((props: { status: string; action: unknown }) => {
    void props;
    return null;
  }),
);

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/jobs/jobs", () => ({ fetchJobDetail }));
vi.mock("next/navigation", () => ({ notFound, unstable_rethrow: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/components/job-lifecycle-actions", () => ({
  JobLifecycleActions: jobLifecycleActions,
}));

const jobId = "4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99";

const pricing = {
  pricingVersion: "2026-09-v1",
  currency: "TRY",
  workerPayout: "1500.50",
  serviceFeeRate: "0.075",
  serviceFeeAmount: "112.54",
  employerTotal: "1613.04",
};

describe("yayımlanmış ilan sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { firstName: "Ayşe" }, failure: null });
  });

  it("kilitlenen fiyatı yanıttaki değerlerle gösterir", async () => {
    fetchJobDetail.mockResolvedValue({
      id: jobId,
      title: "Hafta sonu garson",
      status: "OPEN",
      salaryType: "DAILY",
      startDateTime: "2026-10-10T09:00",
      endDateTime: "2026-10-11T18:00",
      pricing,
    });

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByRole("heading", { name: "Hafta sonu garson" })).toBeVisible();
    expect(screen.getByText("Yayında — başvurulara açık")).toBeVisible();
    expect(screen.getByText("1.500,50 ₺")).toBeVisible();
    expect(screen.getByText("112,54 ₺")).toBeVisible();
    expect(screen.getByText("1.613,04 ₺")).toBeVisible();
  });

  it("kimliği UUID olmayan adresi backend'e hiç sormadan 404 yapar", async () => {
    // Kimlik tarayıcıdan geliyor: yola konmadan önce doğrulanır
    // (`server/address/gateway.ts` aynı kuralı yazıyor).
    await expect(Page({ params: Promise.resolve({ id: "../auth/login" }) })).rejects.toThrowError(
      "NOT_FOUND",
    );
    expect(fetchJobDetail).not.toHaveBeenCalled();
  });

  it("backend ilanı bulamazsa 404 döner, ilanın varlığını sızdırmaz", async () => {
    fetchJobDetail.mockRejectedValue(
      new ApiError({
        status: 404,
        errorCode: "JOB_NOT_FOUND",
        errorCategory: "RESOURCE_NOT_FOUND",
        message: "ham mesaj",
      }),
    );

    await expect(Page({ params: Promise.resolve({ id: jobId }) })).rejects.toThrowError(
      "NOT_FOUND",
    );
  });

  it("başka bir backend arızasında koddan seçilmiş Türkçe hata gösterir", async () => {
    fetchJobDetail.mockRejectedValue(
      new ApiError({
        status: 500,
        errorCode: "UNEXPECTED",
        errorCategory: "UNEXPECTED",
        message: "ham mesaj",
      }),
    );

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByRole("alert")).toHaveTextContent("Bir sorun oluştu");
    expect(screen.queryByText("ham mesaj")).toBeNull();
  });

  it("fiyat dökümü gelmezse uydurmaz", async () => {
    fetchJobDetail.mockResolvedValue({
      id: jobId,
      title: "Hafta sonu garson",
      status: "OPEN",
      salaryType: "DAILY",
      startDateTime: "2026-10-10T09:00",
      endDateTime: "2026-10-11T18:00",
      pricing: null,
    });

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByText("Bu ilanın fiyat dökümü okunamadı.")).toBeVisible();
    expect(screen.queryByRole("group", { name: "Kilitlenen fiyat" })).toBeNull();
  });

  it("kapatma ve iptali ilanın güncel durumuyla birlikte yüzeye çıkarır", async () => {
    fetchJobDetail.mockResolvedValue(jobDetail("OPEN"));

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(jobLifecycleActions).toHaveBeenCalled();
    const props = jobLifecycleActions.mock.calls[0][0];
    expect(props.status).toBe("OPEN");
    expect(typeof props.action).toBe("function");
  });

  it("başvuru listesine ilanın kendi adresinden bağlanır", async () => {
    // Başvuruların menüde bir maddesi yok; ilanı görüntüleyen kullanıcının
    // onlara ulaşabildiği tek yer bu bağlantı.
    fetchJobDetail.mockResolvedValue(jobDetail("OPEN"));

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByRole("link", { name: "Başvuruları gör" })).toHaveAttribute(
      "href",
      `/isveren/ilan/${jobId}/basvurular`,
    );
  });

  it("galeri yönetimine ilanın kendi adresinden bağlanır", async () => {
    fetchJobDetail.mockResolvedValue(jobDetail("OPEN"));

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByRole("link", { name: "Galeriyi yönet" })).toHaveAttribute(
      "href",
      `/isveren/ilan/${jobId}/galeri`,
    );
  });

  it("eylemleri 'yakında' diye erteleyen metni artık taşımaz", async () => {
    fetchJobDetail.mockResolvedValue(jobDetail("OPEN"));

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.queryByText(/yakında ekleniyor/)).toBeNull();
  });

  it("backend enum'undaki her durumu adlandırır", async () => {
    fetchJobDetail.mockResolvedValue(jobDetail("CANCELLED"));

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByText("İptal edildi")).toBeVisible();
  });
});

function jobDetail(status: string) {
  return {
    id: jobId,
    title: "Hafta sonu garson",
    status,
    salaryType: "DAILY",
    startDateTime: "2026-10-10T09:00",
    endDateTime: "2026-10-11T18:00",
    pricing,
    companyId: null,
  };
}
