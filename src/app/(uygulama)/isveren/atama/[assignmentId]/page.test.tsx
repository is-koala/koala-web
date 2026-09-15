import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmployerAssignment } from "@/payments/contract";
import type { Viewer } from "@/server/session/viewer";

const enterShell = vi.hoisted(() => vi.fn());
const readEmployerAssignment = vi.hoisted(() => vi.fn());
const readPaymentTimelineForAssignment = vi.hoisted(() => vi.fn());
const readEmployerPaymentRequirements = vi.hoisted(() => vi.fn());
const readAssignmentResolution = vi.hoisted(() => vi.fn());
const readAssignmentWorkSessions = vi.hoisted(() => vi.fn());
const viewerGates = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/payments/payments", () => ({
  readEmployerAssignment,
  readPaymentTimelineForAssignment,
}));
vi.mock("@/server/payments/preflight", () => ({ readEmployerPaymentRequirements }));
vi.mock("@/server/assignments/resolution", () => ({
  readAssignmentResolution,
  cancelAssignment: vi.fn(),
  createAssignmentDispute: vi.fn(),
}));
vi.mock("@/server/assignments/employer-tracking", () => ({
  readAssignmentWorkSessions,
  completeAssignment: vi.fn(),
}));
vi.mock("@/server/assignments/reviews", () => ({
  createAssignmentReview: vi.fn(),
  isAlreadyReviewed: vi.fn(() => false),
}));
vi.mock("@/server/assignments/identity-reveal", () => ({ readWorkerIdentity: vi.fn() }));
vi.mock("@/server/session/gates", () => ({ viewerGates }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));
vi.mock("next/navigation", () => ({ notFound, unstable_rethrow: vi.fn() }));

import Page, { EmployerAssignmentContent, EmployerAssignmentPage } from "./page";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const assignment: EmployerAssignment = {
  id: assignmentId,
  jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
  title: "Etkinlik görevlisi",
  position: "Karşılama",
  employerType: "INDIVIDUAL",
  workerId: "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f",
  workerName: "Ayşe Yılmaz",
  workerPictureUrl: null,
  companyName: "Koala Etkinlik",
  cityName: "İstanbul",
  districtName: "Kadıköy",
  startsAt: "2026-09-12T09:00:00",
  endsAt: "2026-09-12T18:00:00",
  status: "CONFIRMED",
  paymentStatus: "FAILED",
  pricing: null,
  assignedAt: "2026-09-01T09:00:00Z",
  confirmedAt: null,
  paymentSecuredAt: null,
  cancelledAt: null,
  completedAt: null,
  workHours: 0,
  messaging: null,
  myReview: null,
  counterpartyReviewed: null,
};
const viewer: Viewer = {
  id: "viewer-1", firstName: "Ali", lastName: "Yılmaz", displayName: "Ali Yılmaz",
  email: "ali@example.test", phoneNumber: "", emailVerified: true, phoneVerified: true,
  profilePictureUrl: null, jobTitle: null, about: null, qualifications: null, interests: null,
  experiences: [], educations: [], badges: [], isEmployer: true, identityVerified: true,
  hasIdentityNumber: false, hasAddress: false, companies: [],
};

describe("işveren atama ayrıntısı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer, failure: null });
    readEmployerAssignment.mockResolvedValue(assignment);
    viewerGates.mockReturnValue({ individualPayment: { open: false } });
    readEmployerPaymentRequirements.mockResolvedValue({
      advisories: ["individualBillingAddress"], blocked: ["identityNumber"],
    });
    readPaymentTimelineForAssignment.mockResolvedValue({ resolution: "failed", securedAt: null });
    readAssignmentWorkSessions.mockResolvedValue([]);
    readAssignmentResolution.mockResolvedValue({
      cancellationPreview: null,
      cancellation: null,
      disputes: [{
        id: "dispute-1",
        status: "UNDER_REVIEW",
        reason: "Süre kaydı yanlış",
        resolution: null,
        resolutionNote: null,
        createdAt: "2026-09-06T10:00:00Z",
        resolvedAt: null,
        evidence: { status: "ready", items: [] },
      }],
    });
  });

  it("merkezi atamalar kapısını veri yüklemeden önce taşır", () => {
    const route = Page({ params: Promise.resolve({ assignmentId }), searchParams: Promise.resolve({}) });
    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell: "employer", href: "/isveren/atamalar" });
    expect(readEmployerAssignment).not.toHaveBeenCalled();
  });

  it("ownership yoksa ödeme ayrıntılarını başlatmadan notFound üretir", async () => {
    readEmployerAssignment.mockResolvedValue(null);
    await expect(EmployerAssignmentPage({
      params: Promise.resolve({ assignmentId }), searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(readPaymentTimelineForAssignment).not.toHaveBeenCalled();
  });

  it("bozuk kimlikte ownership backend'ine çıkmadan notFound üretir", async () => {
    await expect(EmployerAssignmentPage({
      params: Promise.resolve({ assignmentId: "42" }), searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(readEmployerAssignment).not.toHaveBeenCalled();
  });

  it("dönüş işareti varsa query statüsü yerine backend sonucunu, dispute ve kapı kiplerini gösterir", async () => {
    render(await EmployerAssignmentContent({
      assignment,
      viewer,
      searchParams: Promise.resolve({ paymentReturn: "1", status: "success" }),
    }));

    expect(screen.getByRole("heading", { name: "Ödeme tamamlanamadı" })).toBeVisible();
    expect(screen.queryByText("Ödeme doğrulandı")).toBeNull();
    expect(screen.getByText(/emanetteki para donduruldu/i)).toBeVisible();
    expect(screen.getAllByText(/açık bir uyuşmazlık var/i)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Ödemeye geç" })).toBeDisabled();
    expect(screen.getByText("Fatura adresin eksik").closest('[role="status"]')).not.toBeNull();
    expect(screen.getByText("Kimlik numaran hesabında kayıtlı değil").closest('[role="alert"]')).not.toBeNull();
  });

  it("REFUNDED atamada sağlayıcı sonucu kesinleşmiş gibi sıradaki adım yazmaz", async () => {
    readPaymentTimelineForAssignment.mockResolvedValue({ resolution: "pending", securedAt: null });

    render(await EmployerAssignmentContent({
      assignment: { ...assignment, paymentStatus: "REFUNDED" },
      viewer,
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByText("Ödeme iade sürecinde.")).toBeVisible();
    expect(screen.queryByText("Ödeme iade edildi.")).toBeNull();
  });

  it("çalışma oturumlarını okuyup zaman çizelgesini çizer", async () => {
    readAssignmentWorkSessions.mockResolvedValue([
      { id: "s1", checkInAt: "2026-09-02T08:00:00Z", checkOutAt: "2026-09-02T12:30:00Z", minutes: 270 },
    ]);

    render(await EmployerAssignmentContent({
      assignment: { ...assignment, status: "IN_PROGRESS", paymentStatus: "HELD_IN_ESCROW" },
      viewer,
      searchParams: Promise.resolve({}),
    }));

    expect(readAssignmentWorkSessions).toHaveBeenCalledWith(assignmentId);
    expect(screen.getByRole("list", { name: "Atama zaman çizelgesi" })).toBeVisible();
    expect(screen.getByText("Toplam 4 sa 30 dk")).toBeVisible();
    expect(screen.getByRole("button", { name: "İşi tamamlandı işaretle" })).toBeEnabled();
  });

  it("para emanette değilken tamamlama düğmesini kilitler ve nedenini yazar", async () => {
    // Sunucu bu durumda 409 `ASSIGNMENT_PAYMENT_NOT_SECURED` döndürüyor ve
    // koşul atama satırından okunabiliyor: düğme açık bırakılıp 409
    // yedirilmiyor.
    render(await EmployerAssignmentContent({
      assignment: { ...assignment, status: "CONFIRMED", paymentStatus: "PENDING_COLLECTION" },
      viewer,
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("button", { name: "İşi tamamlandı işaretle" })).toBeDisabled();
    expect(screen.getByText(/Ödeme emanete alınmadan/)).toBeVisible();
  });

  it("mesaj düğmesini yalnız kapı açıkken çizer; ödeme beklerken ödeme yoluna gönderir", async () => {
    // Kapı sunucudan (`messagingAvailable`, #157); ekran `paymentStatus`tan
    // yeniden türetmiyor. Alan yoksa bölüm başlığıyla birlikte hiç yok.
    const cases = [
      { messaging: { available: true, reason: "AVAILABLE" }, button: true, payLink: false, heading: true },
      { messaging: { available: false, reason: "PAYMENT_REQUIRED" }, button: false, payLink: true, heading: true },
      { messaging: { available: false, reason: "CLOSED" }, button: false, payLink: false, heading: true },
      { messaging: null, button: false, payLink: false, heading: false },
    ] as const;

    for (const testCase of cases) {
      const { unmount } = render(await EmployerAssignmentContent({
        assignment: { ...assignment, paymentStatus: "HELD_IN_ESCROW", messaging: testCase.messaging },
        viewer,
        searchParams: Promise.resolve({}),
      }));

      expect(screen.queryByRole("heading", { name: "Mesajlaşma" }) !== null).toBe(testCase.heading);
      expect(screen.queryByRole("button", { name: "Mesaj gönder" }) !== null).toBe(testCase.button);
      const payLink = screen.queryByRole("link", { name: "Ödemeyi tamamla" });
      expect(payLink !== null).toBe(testCase.payLink);
      if (payLink) expect(payLink).toHaveAttribute("href", `/isveren/atama/${assignmentId}/odeme`);
      if (testCase.messaging?.reason === "CLOSED") {
        expect(screen.getByText(/^Sohbet kapandı\./)).toBeVisible();
      }
      unmount();
    }
  });

  it("işçi onaylamadan tamamlamayı kapatır", async () => {
    render(await EmployerAssignmentContent({
      assignment: { ...assignment, status: "PENDING_CONFIRMATION", paymentStatus: "HELD_IN_ESCROW" },
      viewer,
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("button", { name: "İşi tamamlandı işaretle" })).toBeDisabled();
    expect(screen.getByText(/İşçi atamayı onaylamadan/)).toBeVisible();
  });

  it("değerlendirme formunu yalnız tamamlanmış atamada çizer", async () => {
    // Backend başka durumda 409 `REVIEW_WORK_NOT_COMPLETED` döndürüyor ve
    // koşul satırdan okunabiliyor: form açık bırakılıp 409 yedirilmiyor.
    for (const status of ["PENDING_CONFIRMATION", "CONFIRMED", "IN_PROGRESS", "CANCELLED"] as const) {
      const { unmount } = render(await EmployerAssignmentContent({
        assignment: { ...assignment, status },
        viewer,
        searchParams: Promise.resolve({}),
      }));
      expect(screen.queryByRole("heading", { name: "İşçiyi değerlendir" })).toBeNull();
      unmount();
    }

    render(await EmployerAssignmentContent({
      assignment: {
        ...assignment,
        status: "COMPLETED",
        paymentStatus: "RELEASED_TO_WORKER",
        completedAt: "2026-09-12T18:05:00Z",
      },
      viewer,
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("heading", { name: "İşçiyi değerlendir" })).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "5 yıldız" })).toBeVisible();
    expect(screen.getByLabelText("Yorum (isteğe bağlı)")).toHaveAttribute("maxlength", "2000");
    expect(screen.getByRole("button", { name: "Değerlendirmeyi gönder" })).toBeEnabled();
  });

  it("kimlik bölümünü yalnız işe alınmış atamada çizer; değer sayfa açılırken okunmaz (#185)", async () => {
    // Backend `IdentityRevealManager` başka durumda 404 döndürüyor ve karar
    // satırdan okunabiliyor: düğme hiç çizilmiyor, 404 yedirilmiyor.
    for (const status of ["PENDING_CONFIRMATION", "REJECTED", "CANCELLED", "UNKNOWN"] as const) {
      const { unmount } = render(await EmployerAssignmentContent({
        assignment: { ...assignment, status },
        viewer,
        searchParams: Promise.resolve({}),
      }));
      expect(screen.queryByTestId("worker-identity")).toBeNull();
      unmount();
    }

    for (const status of ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const) {
      const { unmount } = render(await EmployerAssignmentContent({
        assignment: { ...assignment, status },
        viewer,
        searchParams: Promise.resolve({}),
      }));
      const section = screen.getByTestId("worker-identity");
      expect(section).toHaveTextContent("Ayşe Yılmaz adlı çalışanın doğrulanmış kimlik bilgilerini");
      expect(screen.getByRole("button", { name: "Kimlik bilgilerini göster (sigorta için)" })).toBeEnabled();
      // Sayfa açılırken hiçbir alan yok: her okuma kayda geçiyor.
      expect(screen.queryByLabelText("Kimlik bilgileri")).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      unmount();
    }
  });

  it("satır işverenin değerlendirmesini taşıyorsa yükleme anında özet çizilir, form yok; işçinin değerlendirmesi rozet (#179)", async () => {
    render(await EmployerAssignmentContent({
      assignment: {
        ...assignment,
        status: "COMPLETED",
        paymentStatus: "RELEASED_TO_WORKER",
        completedAt: "2026-09-12T18:05:00Z",
        myReview: { rating: 4, comment: "Dakik ve güler yüzlü.", createdAt: "2026-09-13T10:00:00Z" },
        counterpartyReviewed: true,
      },
      viewer,
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("heading", { name: "İşçiyi değerlendir" })).toBeVisible();
    expect(screen.getByTestId("assignment-review-summary")).toHaveTextContent("Değerlendirmeniz: ★4 · Dakik ve güler yüzlü.");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: "Değerlendirmeyi gönder" })).toBeNull();
    expect(screen.getByTestId("counterparty-reviewed")).toHaveTextContent("İşçi sizi değerlendirdi");
  });

  it("işçi kartını fotoğraf, ad ve aday dosyası bağlantısıyla çizer; şirket adını başlığa yazar", async () => {
    render(await EmployerAssignmentContent({
      assignment: { ...assignment, workerPictureUrl: "https://cdn.example.test/ayse.jpg" },
      viewer,
      searchParams: Promise.resolve({}),
    }));

    const card = screen.getByTestId("assignment-worker");
    expect(card).toHaveTextContent("Ayşe Yılmaz");
    expect(card.querySelector("img")).toHaveAttribute("src", "https://cdn.example.test/ayse.jpg");
    expect(screen.getByRole("link", { name: "Aday dosyasını aç" })).toHaveAttribute(
      "href",
      `/isveren/aday/${assignment.workerId}`,
    );
    expect(screen.getByText("Koala Etkinlik")).toBeVisible();
  });

  it("çizelgeye ödemenin emanete alındığı anı, onay anını ve çalışılan saati yazar", async () => {
    readPaymentTimelineForAssignment.mockResolvedValue({
      resolution: "held",
      securedAt: "2026-09-02T14:30:00Z",
    });

    render(await EmployerAssignmentContent({
      assignment: {
        ...assignment,
        status: "IN_PROGRESS",
        paymentStatus: "HELD_IN_ESCROW",
        confirmedAt: "2026-09-01T10:15:00Z",
        workHours: 6,
      },
      viewer,
      searchParams: Promise.resolve({}),
    }));

    const timeline = screen.getByRole("list", { name: "Atama zaman çizelgesi" });
    expect(timeline).toHaveTextContent("İşçi atamayı onayladı1 Eyl 2026 13:15");
    expect(timeline).toHaveTextContent("Ödeme emanete alındı2 Eyl 2026 17:30");
    expect(screen.getByText("6 saat")).toBeVisible();
  });

  it("iptal edilen atamada iptal anını iptal kaydından çizelgeye taşır", async () => {
    // Satır `cancellation` taşımıyor (#282 öncesi); uyuşmazlık paneli için
    // zaten okunan iptal kaydı zamanı veriyor.
    readAssignmentResolution.mockResolvedValue({
      cancellationPreview: null,
      cancellation: {
        id: "c1",
        cancelledByParty: "EMPLOYER",
        reason: "Etkinlik ertelendi",
        noticeMinutes: 1_440,
        feeRate: "0.00",
        feeAmount: "0.00",
        refundAmount: "1500.00",
        cancelledAt: "2026-09-03T08:00:00Z",
        refundStatus: "COMPLETED",
        refundCompletedAt: "2026-09-04T08:00:00Z",
      },
      disputes: [],
    });

    render(await EmployerAssignmentContent({
      assignment: { ...assignment, status: "CANCELLED", paymentStatus: "REFUNDED" },
      viewer,
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("list", { name: "Atama zaman çizelgesi" })).toHaveTextContent(
      "Atama iptal edildi3 Eyl 2026 11:00",
    );
  });
});
