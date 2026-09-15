import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";
import type { EmployerJobDetail } from "@/server/jobs/jobs";

import { sessionExpiryRedirect } from "../../../../../../tests/support/control-flow";
import { jobDetailFixture } from "../../../../../../tests/support/job-detail";

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
const readTransportPlan = vi.hoisted(() => vi.fn());
const transportPlanEditor = vi.hoisted(() =>
  vi.fn((props: { plan: unknown; action: unknown; publishFailed: boolean }) => {
    void props;
    return null;
  }),
);

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/jobs/jobs", () => ({ fetchJobDetail }));
vi.mock("@/server/transport/transport", () => ({ readTransportPlan }));
vi.mock("@/components/transport/transport-plan-editor", () => ({
  TransportPlanEditor: transportPlanEditor,
}));
// `unstable_rethrow` gerçek kalıyor: yönlendirme testi Next'in kendi
// kesmesini sayfadan geçirmeli, taklit edilmiş bir geçiş bunu ölçmezdi.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound,
}));
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
    readTransportPlan.mockResolvedValue(null);
  });

  it("kilitlenen fiyatı yanıttaki değerlerle gösterir", async () => {
    fetchJobDetail.mockResolvedValue(jobDetail("OPEN"));

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByRole("heading", { name: "Hafta sonu garson" })).toBeVisible();
    expect(screen.getByText("Yayında — başvurulara açık")).toBeVisible();
    const breakdown = screen.getByLabelText("Ücret dökümü");
    expect(breakdown).toHaveTextContent("1.500,50 ₺");
    expect(breakdown).toHaveTextContent("112,54 ₺");
    expect(breakdown).toHaveTextContent("1.613,04 ₺");
  });

  it("ilanın tam görünümünü tanıtım gövdesiyle çizer: tarih, adres, kontenjan, açıklama, yayın tarihi", async () => {
    // `JobDetailDto`'nun 25 alanından üçü çiziliyordu (#166); gövde artık
    // herkese açık ilan sayfasıyla ortak.
    fetchJobDetail.mockResolvedValue(
      jobDetail("OPEN", {
        displayAddress: "Bağdat Caddesi No: 231, Caferağa, Kadıköy, İstanbul",
        applicationCount: 6,
      }),
    );

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    const facts = screen.getByLabelText("İlan özeti");
    expect(facts).toHaveTextContent("10 Ekim 2026, 09:00–18:00");
    expect(facts).toHaveTextContent("AdresBağdat Caddesi No: 231, Caferağa, Kadıköy, İstanbul");
    expect(facts).toHaveTextContent("Kontenjan1 / 4 kişi işe alındı");
    expect(facts).toHaveTextContent("Başvuru6 başvuru");
    expect(facts).toHaveTextContent("Yayın tarihi30 Ağu 2026");
    // Sahibe özetteki "Kazanç" satırı yok: fiyat dökümde üç satır olarak duruyor.
    expect(facts).not.toHaveTextContent("Kazanç");
    expect(screen.getByText("Festival alanında misafirleri karşıla.")).toBeVisible();
    expect(screen.getByText("Bilet kontrolü ve yönlendirme")).toBeVisible();
    expect(screen.getByText("Kıyafet: Siyah kıyafet")).toBeVisible();
    expect(screen.getByText("Yaş aralığı: 18–45")).toBeVisible();
    expect(screen.getByText("Sigorta gerekiyor")).toBeVisible();
    expect(screen.getByAltText("Sahne alanı")).toBeVisible();
  });

  it("adres satırı maskeli geldiğinde etiketi yaklaşık konuma düşürür ve il/ilçe yazar", async () => {
    // Şirket ilanını açmamış bir yetkiliye backend `APPROXIMATE` veriyor;
    // web etiketi bayraktan seçiyor, adresi olduğu gibi yazıyor.
    fetchJobDetail.mockResolvedValue(
      jobDetail("OPEN", { addressPrecision: "APPROXIMATE", displayAddress: "Caferağa, Kadıköy, İstanbul" }),
    );

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByLabelText("İlan özeti")).toHaveTextContent("Yaklaşık konumCaferağa, Kadıköy, İstanbul");
  });

  it("başvuru sayısı yanıtta yoksa satırı hiç çizmez, sıfır uydurmaz", async () => {
    fetchJobDetail.mockResolvedValue(jobDetail("OPEN", { applicationCount: null }));

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByLabelText("İlan özeti")).not.toHaveTextContent("Başvuru");
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

  it("oturum yenilemesinin yönlendirmesini hata kartına dönüştürmez", async () => {
    const interrupt = sessionExpiryRedirect(`/giris?next=%2Fisveren%2Filan%2F${jobId}`);
    fetchJobDetail.mockRejectedValue(interrupt);

    await expect(Page({ params: Promise.resolve({ id: jobId }) })).rejects.toBe(interrupt);
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

  it("ücret alanları gelmeyen yanıtta yalnız çalışan ücretini gösterir", async () => {
    /*
     * Sahibe tam döküm gelir; yine de ücret alanları null gelirse
     * (is-koala/koala-backend#304 sonrası eski/yetkisiz bir görünüm) kazanç
     * kaybolmaz ve "okunamadı" uyarısı yazılmaz (is-koala/koala-web#181).
     */
    fetchJobDetail.mockResolvedValue(
      jobDetail("OPEN", {
        pricing: { ...pricing, serviceFeeRate: null, serviceFeeAmount: null, employerTotal: null },
      }),
    );

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    const breakdown = screen.getByLabelText("Ücret dökümü");
    expect(breakdown).toHaveTextContent("Çalışan ücreti");
    expect(breakdown).toHaveTextContent("1.500,50 ₺");
    expect(breakdown).not.toHaveTextContent("Koala hizmet bedeli");
    expect(breakdown).not.toHaveTextContent("112,54 ₺");
    expect(breakdown).not.toHaveTextContent("1.613,04 ₺");
    expect(screen.queryByText("Bu ilanın fiyat dökümü okunamadı.")).toBeNull();
  });

  it("fiyat dökümü gelmezse uydurmaz", async () => {
    fetchJobDetail.mockResolvedValue(jobDetail("OPEN", { pricing: null }));

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByText("Bu ilanın fiyat dökümü okunamadı.")).toBeVisible();
    expect(screen.queryByLabelText("Ücret dökümü")).toBeNull();
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

  it("ulaşım planını ilanla birlikte okuyup düzenleyiciye ilan kimliğiyle bağlar", async () => {
    // Plan yoksa da bölüm çiziliyor (boş düzenleyici); eski sunucu 404
    // veriyor ve okuyucu onu `null`'a çeviriyor (is-koala/koala-web#187).
    fetchJobDetail.mockResolvedValue(jobDetail("OPEN"));
    const plan = { outboundMethod: "SHUTTLE", returnMethod: "NONE", shuttles: [] };
    readTransportPlan.mockResolvedValue(plan);

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(readTransportPlan).toHaveBeenCalledWith(jobId);
    const props = transportPlanEditor.mock.calls[0][0];
    expect(props.plan).toBe(plan);
    expect(typeof props.action).toBe("function");
    expect(props.publishFailed).toBe(false);
  });

  it("sihirbaz planı kaydedemediyse sorgudan gelen notu düzenleyiciye taşır", async () => {
    fetchJobDetail.mockResolvedValue(jobDetail("OPEN"));

    render(
      await Page({
        params: Promise.resolve({ id: jobId }),
        searchParams: Promise.resolve({ ulasim: "kaydedilemedi" }),
      }),
    );

    expect(transportPlanEditor.mock.calls[0][0].publishFailed).toBe(true);
  });

  it("plan okunamazsa ilan yüklü kalır, yalnız bölüm hata kartı çizer", async () => {
    fetchJobDetail.mockResolvedValue(jobDetail("OPEN"));
    readTransportPlan.mockRejectedValue(
      new ApiError({ status: 503, errorCode: "UNEXPECTED", errorCategory: "UNEXPECTED", message: "ham" }),
    );

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByRole("heading", { name: "Hafta sonu garson" })).toBeVisible();
    expect(screen.getByTestId("transport-plan-unavailable")).toHaveTextContent("Ulaşım planı şu an okunamadı");
    expect(transportPlanEditor).not.toHaveBeenCalled();
    expect(screen.queryByText("ham")).toBeNull();
  });

  it("plan okumasının oturum yönlendirmesini bölüm kartına dönüştürmez", async () => {
    fetchJobDetail.mockResolvedValue(jobDetail("OPEN"));
    const interrupt = sessionExpiryRedirect(`/giris?next=%2Fisveren%2Filan%2F${jobId}`);
    readTransportPlan.mockRejectedValue(interrupt);

    await expect(Page({ params: Promise.resolve({ id: jobId }) })).rejects.toBe(interrupt);
  });

  it("backend enum'undaki her durumu adlandırır", async () => {
    fetchJobDetail.mockResolvedValue(jobDetail("CANCELLED"));

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByText("İptal edildi")).toBeVisible();
  });
});

function jobDetail(
  status: EmployerJobDetail["status"],
  overrides: Partial<EmployerJobDetail> = {},
): EmployerJobDetail {
  return {
    ...jobDetailFixture({
      id: jobId,
      title: "Hafta sonu garson",
      status,
      startsAt: "2026-10-10T09:00",
      endsAt: "2026-10-10T18:00",
      addressPrecision: "EXACT",
      pricing,
      images: [{ url: "https://cdn.example.com/1.jpg", caption: "Sahne alanı", cover: true }],
    }),
    companyId: null,
    displayAddress: null,
    applicationCount: null,
    ...overrides,
  };
}
