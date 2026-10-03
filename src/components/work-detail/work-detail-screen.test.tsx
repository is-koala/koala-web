import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  WorkDetail,
  WorkDetailAction,
} from "@/assignments/work-detail";
import type { LocationCapture } from "@/assignments/geolocation";
import type { ConversationAction } from "@/messaging/contract";

import { WorkDetailScreen } from "./work-detail-screen";

/** Konuşma açma bu dosyanın konusu değil; kapı `messaging: null` ile kapalı. */
const conversationAction = vi.fn<ConversationAction>();

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

function workDetail(overrides: Partial<WorkDetail> = {}): WorkDetail {
  return {
    observedAt: new Date("2026-09-12T10:00:00Z").getTime(),
    assignment: {
      id: assignmentId,
      jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
      title: "Etkinlik görevlisi",
      position: "Karşılama",
      categoryName: "Etkinlik",
      companyName: "Koala Etkinlik",
      cityName: "İstanbul",
      districtName: "Kadıköy",
      startsAt: "2026-09-12T09:00:00Z",
      endsAt: "2026-09-12T18:00:00Z",
      status: "CONFIRMED",
      paymentStatus: "HELD_IN_ESCROW",
      workerPayout: "1250.00",
      currency: "TRY",
      employerType: "COMPANY",
      assignedAt: "2026-09-06T10:00:00Z",
      completedAt: null,
      appliedAt: null,
      acceptedAt: null,
      confirmedAt: null,
      paymentSecuredAt: null,
      messaging: null,
      myReview: null,
      counterpartyReviewed: null,
    },
    employer: {
      kind: "company",
      name: "Koala Etkinlik",
      imageUrl: "https://cdn.example.test/companies/koala.webp",
      website: "https://koala.example",
    },
    description: "Misafirleri karşıla.",
    duties: "Yaka kartlarını dağıt.",
    dressCode: "Siyah gömlek",
    fullAddress: "Caferağa Mahallesi, Moda Caddesi No: 12/4",
    additionalDirections: "Arka kapıdan girin.",
    directions: null,
    headcount: 4,
    hiredCount: 1,
    createdAt: "2026-08-30T07:15:00Z",
    sessions: [{
      id: "4b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
      checkInAt: "2026-09-11T09:00:00Z",
      checkOutAt: "2026-09-11T10:30:00Z",
      minutes: 90,
    }],
    transport: null,
    resolution: {
      cancellationPreview: {
        noticeMinutes: 120,
        cancellableNow: true,
      },
      cancellation: null,
      disputes: [],
    },
    ...overrides,
  };
}

const located = async (): Promise<LocationCapture> => ({
  status: "located",
  point: { latitude: 40.98, longitude: 29.02 },
});

describe("iş ve çalışma oturumu ayrıntısı", () => {
  beforeEach(() => vi.setSystemTime(new Date("2026-09-12T10:00:00Z")));
  afterEach(() => vi.useRealTimers());

  it("mesaj düğmesini yalnız kapı açıkken çizer; ödeme beklerken çalışana ödeme yolu sunmaz", async () => {
    // Kapı sunucudan (`messagingAvailable`, #157). Çalışan ödemeyi kendi
    // tamamlayamaz: açıklama var, "Ödemeyi tamamla" yok. Alan yoksa bölüm
    // başlığıyla birlikte hiç yok.
    const user = userEvent.setup();
    const cases = [
      { messaging: { available: true, reason: "AVAILABLE" }, button: true, heading: true },
      { messaging: { available: false, reason: "PAYMENT_REQUIRED" }, button: false, heading: true },
      { messaging: { available: false, reason: "CLOSED" }, button: false, heading: true },
      { messaging: null, button: false, heading: false },
    ] as const;

    for (const testCase of cases) {
      const openConversation = vi.fn<ConversationAction>().mockResolvedValue({ status: "idle" });
      const detail = workDetail({
        assignment: { ...workDetail().assignment, messaging: testCase.messaging },
      });
      const { unmount } = render(
        <WorkDetailScreen
          conversationAction={openConversation}
          initialDetail={detail}
          action={vi.fn<WorkDetailAction>()}
          locate={located}
        />,
      );

      expect(screen.queryByRole("heading", { name: "Mesajlaşma" }) !== null).toBe(testCase.heading);
      expect(screen.queryByRole("link", { name: "Ödemeyi tamamla" })).toBeNull();
      const button = screen.queryByRole("button", { name: "Mesaj gönder" });
      expect(button !== null).toBe(testCase.button);
      if (button) {
        await user.click(button);
        expect(openConversation).toHaveBeenCalledTimes(1);
      }
      if (testCase.messaging?.reason === "PAYMENT_REQUIRED") {
        expect(screen.getByText(/işveren ödemeyi tamamladığında açılır/)).toBeVisible();
      }
      unmount();
    }
  });

  it("konuşma açma reddini kataloğ metniyle gösterir", async () => {
    const user = userEvent.setup();
    const openConversation = vi.fn<ConversationAction>().mockResolvedValue({
      status: "error",
      errorCode: "MESSAGING_WINDOW_CLOSED",
      httpStatus: 409,
    });
    render(
      <WorkDetailScreen
        conversationAction={openConversation}
        initialDetail={workDetail({
          assignment: { ...workDetail().assignment, messaging: { available: true, reason: "AVAILABLE" } },
        })}
        action={vi.fn<WorkDetailAction>()}
        locate={located}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mesaj gönder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/^Bu atamanın mesajlaşma penceresi kapandı/);
  });

  it("sunucu ayrıntısını, kesin adresi, zaman çizelgesini ve toplam süreyi gösterir", () => {
    const action = vi.fn<WorkDetailAction>();
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={workDetail()} action={action} locate={located} />);

    expect(screen.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();
    expect(screen.getByText("Caferağa Mahallesi, Moda Caddesi No: 12/4")).toBeVisible();
    expect(screen.getByText("Misafirleri karşıla.")).toBeVisible();
    expect(screen.getByText("Yaka kartlarını dağıt.")).toBeVisible();
    expect(screen.getByText("Siyah gömlek")).toBeVisible();
    expect(screen.getByText("Toplam 1 sa 30 dk")).toBeVisible();
    const timeline = screen.getByRole("list", { name: "Atama zaman çizelgesi" });
    expect(within(timeline).getByText("Atama oluşturuldu")).toBeVisible();
    expect(within(timeline).getByText("İşe giriş yapıldı")).toBeVisible();
    expect(within(timeline).getByText("İşten çıkış yapıldı")).toBeVisible();
    expect(screen.getByRole("button", { name: "İşe giriş yap" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "İşten çıkış yap" })).toBeNull();
  });

  it("açık oturumda yalnız çıkışı ve canlı sayacı gösterir", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00Z"));
    const open = workDetail({
      assignment: { ...workDetail().assignment, status: "IN_PROGRESS" },
      sessions: [{
        id: "5b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        checkInAt: "2026-09-12T09:00:00Z",
        checkOutAt: null,
        minutes: null,
      }],
    });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={open} action={vi.fn()} locate={located} />);

    expect(screen.queryByRole("button", { name: "İşe giriş yap" })).toBeNull();
    expect(screen.getByRole("button", { name: "İşten çıkış yap" })).toBeVisible();
    expect(screen.getByRole("timer")).toHaveTextContent("01:00:00");

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(screen.getByRole("timer")).toHaveTextContent("01:00:01");
  });

  it("ilk sayaç metnini hydration sırasında değişmeyen sunucu zamanından kurar", () => {
    vi.setSystemTime(new Date("2026-09-12T10:00:05Z"));
    const open = workDetail({
      assignment: { ...workDetail().assignment, status: "IN_PROGRESS" },
      sessions: [{
        id: "5b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        checkInAt: "2026-09-12T09:00:00Z",
        checkOutAt: null,
        minutes: null,
      }],
    });

    render(
      <WorkDetailScreen conversationAction={conversationAction} initialDetail={open} action={vi.fn()} locate={located} />,
    );

    expect(screen.getByRole("timer")).toHaveTextContent("01:00:00");
  });

  it("konum izni reddedilince uyarıp check-in'i konumsuz tamamlar", async () => {
    const user = userEvent.setup();
    const refreshed = workDetail({
      assignment: { ...workDetail().assignment, status: "IN_PROGRESS" },
      sessions: [{
        id: "5b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        checkInAt: "2026-09-12T10:00:00Z",
        checkOutAt: null,
        minutes: null,
      }],
    });
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({ status: "done", detail: refreshed });
    const locate = vi.fn(async (): Promise<LocationCapture> => ({
      status: "unavailable",
      reason: "denied",
      point: null,
    }));
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={workDetail()} action={action} locate={locate} />);

    await user.click(screen.getByRole("button", { name: "İşe giriş yap" }));

    expect(locate).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith({
      type: "checkpoint",
      kind: "check-in",
      point: null,
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Konum izni verilmedi; giriş konumsuz kaydedildi.",
    );
    // `getByRole`, `findByRole` değil: `applyResult` `setDetail` ile `setFeedback`'i
    // aynı senkron blokta çağırıyor, React onları tek commit'te topluyor. Yani uyarı
    // görünür olduğunda yenilenen oturumun düğmesi de görünür olmak ZORUNDA.
    // Beklemek, bayat arayüzü 1 saniyeye kadar kabul eder ve şu gerilemeyi gizler:
    // uyarı çizilir ama ekranda hâlâ giriş düğmesi durur — ikinci bir check-in daveti.
    expect(screen.getByRole("button", { name: "İşten çıkış yap" })).toBeVisible();
  });

  it("güvensiz bağlam sonucunda konumsuz devam uyarısını açıklar", async () => {
    const user = userEvent.setup();
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({ status: "done", detail: workDetail() });
    const locate = vi.fn(async (): Promise<LocationCapture> => ({
      status: "unavailable",
      reason: "insecure",
      point: null,
    }));
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={workDetail()} action={action} locate={locate} />);

    await user.click(screen.getByRole("button", { name: "İşe giriş yap" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Güvenli bağlantı olmadığı için konum alınamadı; giriş konumsuz kaydedildi.",
    );
  });

  it("409/404 yarışını Türkçe anlatır ve action'ın yeniden okuduğu duruma geçer", async () => {
    const user = userEvent.setup();
    const open = workDetail({
      assignment: { ...workDetail().assignment, status: "IN_PROGRESS" },
      sessions: [{
        id: "5b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        checkInAt: "2026-09-12T10:00:00Z",
        checkOutAt: null,
        minutes: null,
      }],
    });
    const action = vi.fn<WorkDetailAction>()
      .mockResolvedValueOnce({
        status: "error",
        errorCode: "TIMESHEET_ALREADY_CHECKED_IN",
        httpStatus: 409,
        detail: open,
      })
      .mockResolvedValueOnce({
        status: "error",
        errorCode: "TIMESHEET_NOT_CHECKED_IN",
        httpStatus: 404,
        detail: workDetail(),
      });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={workDetail()} action={action} locate={located} />);

    await user.click(screen.getByRole("button", { name: "İşe giriş yap" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Zaten açık bir çalışma oturumu var. Güncel durum gösteriliyor.",
    );
    await user.click(await screen.findByRole("button", { name: "İşten çıkış yap" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Açık çalışma oturumu bulunamadı. Güncel durum gösteriliyor.",
    );
    expect(await screen.findByRole("button", { name: "İşe giriş yap" })).toBeVisible();
  });

  it("check-out sonrası sunucunun dakika değerini geçmişe ve toplama geçirir", async () => {
    const user = userEvent.setup();
    const open = workDetail({
      assignment: { ...workDetail().assignment, status: "IN_PROGRESS" },
      sessions: [{
        id: "5b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        checkInAt: "2026-09-12T09:00:00Z",
        checkOutAt: null,
        minutes: null,
      }],
    });
    const closed = workDetail({
      assignment: { ...workDetail().assignment, status: "IN_PROGRESS" },
      sessions: [{
        id: "5b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        checkInAt: "2026-09-12T09:00:00Z",
        checkOutAt: "2026-09-12T10:07:00Z",
        minutes: 67,
      }],
    });
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({ status: "done", detail: closed });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={open} action={action} locate={located} />);

    await user.click(screen.getByRole("button", { name: "İşten çıkış yap" }));

    expect(action).toHaveBeenCalledWith({
      type: "checkpoint",
      kind: "check-out",
      point: { latitude: 40.98, longitude: 29.02 },
    });
    expect(await screen.findByText("Toplam 1 sa 7 dk")).toBeVisible();
    expect(screen.getByText("1 sa 7 dk")).toBeVisible();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(await screen.findByRole("button", { name: "İşe giriş yap" })).toBeEnabled();
  });

  it("kesin adresli etkin atamada toplu taşımayla yol tarifini iki haritada açar", async () => {
    // is-koala/koala-web#178: anahtarsız evrensel bağlantı, yeni sekme,
    // Referer'sız; varış saati URL'de taşınamıyor, iş başlangıcı yanında yazılı.
    const directions = {
      google: "https://www.google.com/maps/dir/?api=1&destination=40.98%2C29.02&travelmode=transit",
      apple: "https://maps.apple.com/?daddr=40.98%2C29.02&dirflg=r",
    };
    render(
      <WorkDetailScreen
        conversationAction={conversationAction}
        initialDetail={workDetail({ directions })}
        action={vi.fn()}
        locate={located}
      />,
    );

    const route = screen.getByRole("region", { name: "Toplu taşımayla yol tarifi" });
    const google = within(route).getByRole("link", { name: /Google Haritalar/ });
    const apple = within(route).getByRole("link", { name: /Apple Haritalar/ });
    expect(google).toHaveAttribute("href", directions.google);
    expect(apple).toHaveAttribute("href", directions.apple);
    for (const link of [google, apple]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(route).toHaveTextContent("12 Eyl 2026 12:00");
  });

  it("ulaşım planı varken yol tarifini kendi imkânınla seçeneği olarak sunar", () => {
    const directions = {
      google: "https://www.google.com/maps/dir/?api=1&destination=40.98%2C29.02&travelmode=transit",
      apple: "https://maps.apple.com/?daddr=40.98%2C29.02&dirflg=r",
    };
    render(
      <WorkDetailScreen
        conversationAction={conversationAction}
        initialDetail={workDetail({
          directions,
          transport: {
            outboundMethod: "CASH_ALLOWANCE",
            returnMethod: "SELF",
            allowanceAmount: "150.00",
            allowanceNote: null,
            notes: null,
            shuttles: [],
            seats: [],
          },
        })}
        action={vi.fn()}
        locate={located}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Kendi imkânınla: toplu taşımayla yol tarifi" }),
    ).toBeVisible();
  });

  it("yol tarifi yoksa bölüm de yok", () => {
    render(
      <WorkDetailScreen
        conversationAction={conversationAction}
        initialDetail={workDetail({ directions: null })}
        action={vi.fn()}
        locate={located}
      />,
    );

    expect(screen.queryByRole("link", { name: /Google Haritalar/ })).toBeNull();
    expect(screen.queryByRole("region", { name: /yol tarifi/ })).toBeNull();
  });

  it("odak ve görünürlük dönüşlerinde sunucuyu yeniler; kaybolan tam adresi tutmaz", async () => {
    const withoutAddress = workDetail({ fullAddress: null });
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({ status: "done", detail: withoutAddress });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={workDetail()} action={action} locate={located} />);

    fireEvent.focus(window);
    expect(await screen.findByText("Adres işin güncel durumunda paylaşılmıyor.")).toBeVisible();
    expect(screen.queryByText("Caferağa Mahallesi, Moda Caddesi No: 12/4")).toBeNull();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent(document, new Event("visibilitychange"));
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action).toHaveBeenNthCalledWith(1, { type: "refresh" });
    expect(action).toHaveBeenNthCalledWith(2, { type: "refresh" });
  });

  it("sekme dönüşünde yeni açık oturum sayacını yenilenen sunucu zamanından hemen kurar", async () => {
    const initial = workDetail({
      observedAt: new Date("2026-09-12T08:00:00Z").getTime(),
      sessions: [],
    });
    const refreshed = workDetail({
      observedAt: new Date("2026-09-12T10:00:00Z").getTime(),
      assignment: { ...workDetail().assignment, status: "IN_PROGRESS" },
      sessions: [{
        id: "5b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        checkInAt: "2026-09-12T09:00:00Z",
        checkOutAt: null,
        minutes: null,
      }],
    });
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({ status: "done", detail: refreshed });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={initial} action={action} locate={located} />);

    fireEvent.focus(window);

    expect(await screen.findByRole("timer")).toHaveTextContent("01:00:00");
  });

  it("atama sunucudan kaybolursa eski tam adresi tarayıcı görünümünde tutmaz", async () => {
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({
      status: "error",
      errorCode: "JOB_ASSIGNMENT_NOT_FOUND",
      httpStatus: 404,
      detail: null,
    });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={workDetail()} action={action} locate={located} />);

    fireEvent.focus(window);

    // 404 cümlesi öbür atama bölümleriyle ortak köprüden (`assignmentErrorMessage`):
    // backend var/yok sızdırmıyor, ekran da ayırt etmiyor.
    expect(await screen.findByRole("alert")).toHaveTextContent("Atama bulunamadı veya erişim yetkiniz yok.");
    expect(screen.queryByText("Caferağa Mahallesi, Moda Caddesi No: 12/4")).toBeNull();
    expect(screen.getByRole("link", { name: "İşlerime dön" })).toHaveAttribute("href", "/panel/islerim");
  });

  it("iptal, uyuşmazlık ve değerlendirme aksiyonlarını yalnız uygun durumda gösterir", async () => {
    const user = userEvent.setup();
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({ status: "done", detail: workDetail() });
    const { rerender } = render(
      <WorkDetailScreen conversationAction={conversationAction} initialDetail={workDetail()} action={action} locate={located} />,
    );

    expect(screen.getByText("Çalışmadan çekilme")).toBeVisible();
    await user.click(screen.getByText("Çalışmadan çekilme"));
    expect(screen.getByText("Başlangıca kalan").closest("div")).toHaveTextContent("Başlangıca kalan2 sa");
    expect(screen.getByText(/bu atama için ödeme alamazsın/i)).toBeVisible();
    expect(screen.getByText(/işverene ödemenin tamamının iade süreci başlar/i)).toBeVisible();
    expect(screen.queryByText("Kesinti")).toBeNull();
    expect(screen.queryByText(/İşverene iade tutarı/i)).toBeNull();
    expect(screen.getByText("Uyuşmazlık aç")).toBeVisible();
    expect(screen.queryByText("Değerlendirme bırak")).toBeNull();

    await user.click(screen.getByText("Uyuşmazlık aç"));
    expect(screen.getByLabelText("Kanıt dosyaları (isteğe bağlı)")).toHaveAttribute(
      "accept",
      ".pdf,.png,.jpg,.jpeg,.webp",
    );
    await user.type(screen.getByLabelText("Uyuşmazlık nedeni"), "Çalışma süresi yanlış");
    await user.click(screen.getByRole("button", { name: "Uyuşmazlığı gönder" }));
    expect(action).toHaveBeenCalledWith({ type: "dispute", reason: "Çalışma süresi yanlış" });
    expect(await screen.findByRole("status")).toHaveTextContent("Uyuşmazlık kaydın alındı.");

    const completed = workDetail({
      assignment: {
        ...workDetail().assignment,
        status: "COMPLETED",
        paymentStatus: "RELEASED_TO_WORKER",
        completedAt: "2026-09-12T18:02:00Z",
      },
      resolution: {
        cancellationPreview: null,
        cancellation: null,
        disputes: [],
      },
    });
    rerender(<WorkDetailScreen conversationAction={conversationAction} key="completed" initialDetail={completed} action={action} locate={located} />);
    expect(screen.queryByText("Çalışmadan çekilme")).toBeNull();
    expect(screen.queryByText("Uyuşmazlık aç")).toBeNull();
    expect(screen.getByText("Değerlendirme bırak")).toBeVisible();
  });

  it("ödeme alınmamış atamadan çekilmede olmayan bir iade vaat etmez", async () => {
    const user = userEvent.setup();
    const unpaid = workDetail({
      assignment: { ...workDetail().assignment, paymentStatus: "PENDING_COLLECTION" },
    });
    render(<WorkDetailScreen
      conversationAction={conversationAction}
      initialDetail={unpaid}
      action={vi.fn<WorkDetailAction>().mockResolvedValue({ status: "done", detail: unpaid })}
      locate={located}
    />);

    await user.click(screen.getByText("Çalışmadan çekilme"));

    expect(screen.getByText(/henüz ödeme alınmadığı için iade gerekmez/i)).toBeVisible();
    expect(screen.queryByText(/işverene ödemenin tamamının iade süreci başlar/i)).toBeNull();
  });

  it("işçi uyuşmazlık gerekçesiyle seçtiği kanıtları action'a taşır", async () => {
    const user = userEvent.setup();
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({
      status: "done",
      detail: workDetail(),
      feedback: {
        kind: "warning",
        message: "Uyuşmazlık açıldı. 0 kanıt yüklendi, 1 kanıt yüklenemedi.",
      },
    });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={workDetail()} action={action} locate={located} />);

    await user.click(screen.getByText("Uyuşmazlık aç"));
    await user.type(screen.getByLabelText("Uyuşmazlık nedeni"), "Çalışma süresi yanlış");
    const evidence = screen.getByLabelText("Kanıt dosyaları (isteğe bağlı)");
    const file = new File(["png"], "vardiya.png", { type: "image/png" });
    await user.upload(evidence, file);
    await user.click(screen.getByRole("button", { name: "Uyuşmazlığı gönder" }));

    expect(action).toHaveBeenCalledWith({
      type: "dispute",
      reason: "Çalışma süresi yanlış",
      evidence: [file],
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Uyuşmazlık açıldı. 0 kanıt yüklendi, 1 kanıt yüklenemedi.",
    );
  });

  it("iptal edilemeyen atamada önizlemeyi çizer, yalnız göndermeyi kapatır", async () => {
    // Kabul kriteri (#85): işçi `cancellableNow: false` iken de başlangıca
    // kalan süreyi ve iptal edememe nedenini okuyabilmeli, iptal düğmesi
    // gizli değil kapalı olmalı. Uç bu durumda 409 değil 200 + süre
    // döndürüyor; bloğu gizlemek işçiye hem süreyi hem gerekçeyi
    // kaybettiriyor, düğmeyi aratıyordu.
    const user = userEvent.setup();
    const closed = workDetail({
      resolution: {
        ...workDetail().resolution,
        cancellationPreview: { noticeMinutes: 120, cancellableNow: false },
      },
    });

    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={closed} action={vi.fn()} locate={located} />);

    await user.click(screen.getByText("Çalışmadan çekilme"));

    expect(screen.getByText("Başlangıca kalan").closest("div")).toHaveTextContent("Başlangıca kalan2 sa");
    expect(screen.getByRole("button", { name: "Atamadan çekil" }))
      .toHaveAttribute("data-disabled-kind", "permanent");
    expect(screen.getByRole("button", { name: "Atamadan çekil" })).toBeDisabled();
    expect(screen.getByLabelText("Çekilme nedeni")).toBeDisabled();
    expect(screen.getByText(/şu anda bu atamadan çekilemezsin/i)).toBeVisible();
    // İşçi işverenin rakamlarını görmüyor: kesinti ve iade sunucuda kesiliyor.
    expect(screen.queryByText("Kesinti")).toBeNull();
    expect(screen.queryByText("İade")).toBeNull();
  });

  it("iptal açıkken gerekçe metnini yazmaz", async () => {
    // Kapalılık gerekçesi yalnız kapalıyken duruyor; her zaman çizilseydi
    // düğmenin açık olduğu ekranda da "çekilemezsin" yazardı.
    const user = userEvent.setup();
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={workDetail()} action={vi.fn()} locate={located} />);

    await user.click(screen.getByText("Çalışmadan çekilme"));

    expect(screen.getByRole("button", { name: "Atamadan çekil" })).toBeEnabled();
    expect(screen.getByLabelText("Çekilme nedeni")).toBeEnabled();
    expect(screen.queryByText(/şu anda bu atamadan çekilemezsin/i)).toBeNull();
  });

  it("açık uyuşmazlık varken ikinci uyuşmazlığı açmaz ama yeni kanıt kabul eder", () => {
    const activeDispute = workDetail({
      resolution: {
        ...workDetail().resolution,
        disputes: [{
          id: "dispute-1",
          status: "UNDER_REVIEW",
          reason: "Çalışma süresi yanlış",
          resolution: null,
          resolutionNote: null,
          createdAt: "2026-09-06T10:00:00Z",
          resolvedAt: null,
          evidence: { status: "ready", items: [] },
        }],
      },
    });

    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={activeDispute} action={vi.fn()} locate={located} />);

    expect(screen.queryByRole("button", { name: "Uyuşmazlığı gönder" })).toBeNull();
    expect(screen.getByRole("button", { name: "Kanıtları yükle" })).toBeVisible();
    expect(screen.getByLabelText("Yeni kanıt dosyaları")).not.toHaveAttribute("multiple");
    // İptal bloğu da çizilmiyor: nedeni yukarıdaki kalıcı uyuşmazlık şeridinde
    // zaten yazılı, blok içinde ikinci kez tekrar edilmesi gerekmiyor.
    expect(screen.queryByText("Çalışmadan çekilme")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("açık bir uyuşmazlık var");
  });

  it("işçi kanıtı başarıyla yükleyince dosya seçimini sıfırlar", async () => {
    const user = userEvent.setup();
    const activeDispute = workDetail({
      resolution: {
        ...workDetail().resolution,
        disputes: [{
          id: "dispute-1",
          status: "UNDER_REVIEW",
          reason: "Çalışma süresi yanlış",
          resolution: null,
          resolutionNote: null,
          createdAt: "2026-09-06T10:00:00Z",
          resolvedAt: null,
          evidence: { status: "ready", items: [] },
        }],
      },
    });
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({
      status: "done",
      detail: activeDispute,
    });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={activeDispute} action={action} locate={located} />);
    const input = screen.getByLabelText<HTMLInputElement>("Yeni kanıt dosyaları");
    const file = new File(["png"], "vardiya.png", { type: "image/png" });

    await user.upload(input, file);
    fireEvent.submit(input.closest("form")!);

    await vi.waitFor(() => expect(action).toHaveBeenCalledWith({
      type: "evidence",
      disputeId: "dispute-1",
      evidence: [file],
    }));
    await vi.waitFor(() => expect(input.files).toHaveLength(0));
  });

  it("şirket ilanında işveren kartını logo, ad ve web sitesiyle; kontenjan, ilan tarihi ve tarifi çizer", () => {
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={workDetail()} action={vi.fn()} locate={located} />);

    const employer = screen.getByTestId("work-employer");
    expect(within(employer).getByText("Şirket")).toBeVisible();
    expect(within(employer).getByText("Koala Etkinlik")).toBeVisible();
    // Logo süsleyici (`alt=""`): adı yanında yazılı, ekran okuyucu iki kez duymaz.
    expect(employer.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example.test/companies/koala.webp",
    );
    expect(within(employer).getByRole("link", { name: "Web sitesi" })).toHaveAttribute(
      "href",
      "https://koala.example",
    );
    expect(screen.getByText("Şirket ilanı")).toBeVisible();
    // Ad kartta; başlığın altında ikinci kez yazılmıyor.
    expect(screen.getAllByText("Koala Etkinlik")).toHaveLength(1);
    expect(screen.getByText("Kontenjan")).toBeVisible();
    expect(screen.getByText("1 / 4 kişi")).toBeVisible();
    expect(screen.getByText("İlan tarihi")).toBeVisible();
    expect(screen.getByText("30 Ağu 2026 10:15")).toBeVisible();
    expect(screen.getByText("Arka kapıdan girin.")).toBeVisible();
  });

  it("bireysel ilanda ilanı açan kişiyi baş harfli avatarla ve rozetle gösterir; web sitesi bağlantısı yok", () => {
    const individual = workDetail({
      assignment: { ...workDetail().assignment, employerType: "INDIVIDUAL", companyName: null },
      employer: { kind: "person", name: "Ayşe Yıldız", imageUrl: null, website: null },
    });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={individual} action={vi.fn()} locate={located} />);

    const employer = screen.getByTestId("work-employer");
    expect(within(employer).getByText("İşveren")).toBeVisible();
    expect(within(employer).getByText("Ayşe Yıldız")).toBeVisible();
    expect(within(employer).getByText("A")).toBeInTheDocument();
    expect(employer.querySelector("img")).toBeNull();
    expect(within(employer).queryByRole("link", { name: "Web sitesi" })).toBeNull();
    expect(screen.getByText("Bireysel ilan")).toBeVisible();
    expect(screen.queryByText("Şirket ilanı")).toBeNull();
  });

  it("işveren, kontenjan, ilan tarihi ve tarif gelmediyse o satırları çizmez; şirket adı başlık altına düşer", () => {
    const bare = workDetail({
      assignment: { ...workDetail().assignment, employerType: "UNKNOWN" },
      employer: null,
      additionalDirections: null,
      headcount: null,
      hiredCount: 0,
      createdAt: null,
    });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={bare} action={vi.fn()} locate={located} />);

    expect(screen.queryByTestId("work-employer")).toBeNull();
    expect(screen.getByText("Koala Etkinlik")).toBeVisible();
    expect(screen.queryByText("Kontenjan")).toBeNull();
    expect(screen.queryByText("İlan tarihi")).toBeNull();
    expect(screen.queryByText(/Tarif:/)).toBeNull();
    expect(screen.queryByText("Şirket ilanı")).toBeNull();
    expect(screen.queryByText("Bireysel ilan")).toBeNull();
  });

  it("çizelgeye başvuru, kabul, onay ve ödeme adımlarını yalnız zamanları geldiyse sırayla koyar", () => {
    const stamped = workDetail({
      assignment: {
        ...workDetail().assignment,
        appliedAt: "2026-09-05T08:00:00Z",
        acceptedAt: "2026-09-06T09:59:00Z",
        confirmedAt: "2026-09-06T12:00:00Z",
        paymentSecuredAt: "2026-09-07T09:00:00Z",
      },
    });
    const { unmount } = render(
      <WorkDetailScreen conversationAction={conversationAction} initialDetail={stamped} action={vi.fn()} locate={located} />,
    );

    const timeline = screen.getByRole("list", { name: "Atama zaman çizelgesi" });
    expect(within(timeline).getAllByRole("listitem").map((item) => item.querySelector("strong")?.textContent)).toEqual([
      "Başvuru yapıldı",
      "Başvurun kabul edildi",
      "Atama oluşturuldu",
      "Atamayı onayladın",
      "Ödeme emanete alındı",
      "İşe giriş yapıldı",
      "İşten çıkış yapıldı",
    ]);
    expect(within(timeline).getByText("7 Eyl 2026 12:00")).toBeVisible();
    unmount();

    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={workDetail()} action={vi.fn()} locate={located} />);
    const bare = screen.getByRole("list", { name: "Atama zaman çizelgesi" });
    expect(within(bare).queryByText("Başvuru yapıldı")).toBeNull();
    expect(within(bare).queryByText("Başvurun kabul edildi")).toBeNull();
    expect(within(bare).queryByText("Atamayı onayladın")).toBeNull();
    expect(within(bare).queryByText("Ödeme emanete alındı")).toBeNull();
  });

  it("iptal edilmiş atamada çizelgeye iptal kaydının anını yazar; kayıt yoksa satır zamansız kalır", () => {
    const cancelledAt = "2026-09-11T15:30:00Z";
    const cancelled = workDetail({
      assignment: { ...workDetail().assignment, status: "CANCELLED" },
      sessions: [],
      resolution: {
        cancellationPreview: null,
        cancellation: {
          id: "cancellation-1",
          cancelledByParty: "EMPLOYER",
          reason: "Etkinlik ertelendi",
          noticeMinutes: 4_320,
          cancelledAt,
        },
        disputes: [],
      },
    });
    const { unmount } = render(
      <WorkDetailScreen conversationAction={conversationAction} initialDetail={cancelled} action={vi.fn()} locate={located} />,
    );

    const timeline = screen.getByRole("list", { name: "Atama zaman çizelgesi" });
    const row = within(timeline).getByText("Atama iptal edildi").closest("li")!;
    expect(within(row).getByText("11 Eyl 2026 18:30")).toHaveAttribute("datetime", cancelledAt);
    unmount();

    const withoutRecord = workDetail({
      assignment: { ...workDetail().assignment, status: "CANCELLED" },
      sessions: [],
      resolution: { cancellationPreview: null, cancellation: null, disputes: [] },
    });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={withoutRecord} action={vi.fn()} locate={located} />);
    const bareRow = screen.getByText("Atama iptal edildi").closest("li")!;
    expect(bareRow.querySelector("time")).toBeNull();
  });

  it("tamamlanan atamada değerlendirme gönderilince sunucunun yeniden okuduğu satır formu kapatır, özet yazılır (#179)", async () => {
    const user = userEvent.setup();
    const completed = workDetail({
      assignment: {
        ...workDetail().assignment,
        status: "COMPLETED",
        paymentStatus: "RELEASED_TO_WORKER",
        completedAt: "2026-09-12T18:02:00Z",
      },
      resolution: { cancellationPreview: null, cancellation: null, disputes: [] },
    });
    const reviewed = workDetail({
      ...completed,
      assignment: {
        ...completed.assignment,
        myReview: { rating: 4, comment: "İyi bir işverendi", createdAt: "2026-09-13T10:00:00Z" },
      },
    });
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({ status: "done", detail: reviewed });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={completed} action={action} locate={located} />);

    expect(screen.queryByTestId("assignment-review-summary")).toBeNull();
    await user.click(screen.getByText("Değerlendirme bırak"));
    await user.selectOptions(screen.getByLabelText("Puan"), "4");
    await user.type(screen.getByLabelText("Yorum"), "İyi bir işverendi");
    await user.click(screen.getByRole("button", { name: "Değerlendirmeyi gönder" }));

    expect(action).toHaveBeenCalledWith({ type: "review", rating: 4, comment: "İyi bir işverendi" });
    expect(await screen.findByRole("status")).toHaveTextContent("Değerlendirmen kaydedildi.");
    const summary = screen.getByTestId("assignment-review-summary");
    expect(summary).toHaveTextContent("Değerlendirmen: ★4 · İyi bir işverendi");
    expect(summary.querySelector("time")).toHaveAttribute("datetime", "2026-09-13T10:00:00Z");
    expect(screen.queryByText("Değerlendirme bırak")).toBeNull();
    expect(screen.queryByRole("button", { name: "Değerlendirmeyi gönder" })).toBeNull();
  });

  it("satır yükleme anında değerlendirme taşıyorsa form hiç çizilmez; karşı taraf rozeti içerik taşımaz", () => {
    const reviewed = workDetail({
      assignment: {
        ...workDetail().assignment,
        status: "COMPLETED",
        paymentStatus: "RELEASED_TO_WORKER",
        completedAt: "2026-09-12T18:02:00Z",
        myReview: { rating: 5, comment: null, createdAt: null },
        counterpartyReviewed: true,
      },
      resolution: { cancellationPreview: null, cancellation: null, disputes: [] },
    });
    const { unmount } = render(
      <WorkDetailScreen conversationAction={conversationAction} initialDetail={reviewed} action={vi.fn()} locate={located} />,
    );

    expect(screen.getByTestId("assignment-review-summary")).toHaveTextContent(/Değerlendirmen: ★5$/);
    expect(screen.getByTestId("assignment-review-summary").querySelector("time")).toBeNull();
    expect(screen.queryByText("Değerlendirme bırak")).toBeNull();
    expect(screen.getByTestId("counterparty-reviewed")).toHaveTextContent("İşveren seni değerlendirdi");
    unmount();

    // Eski sunucu: iki alan da null → form açık, rozet yok.
    const legacy = workDetail({
      assignment: { ...reviewed.assignment, myReview: null, counterpartyReviewed: null },
      resolution: { cancellationPreview: null, cancellation: null, disputes: [] },
    });
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={legacy} action={vi.fn()} locate={located} />);
    expect(screen.getByText("Değerlendirme bırak")).toBeVisible();
    expect(screen.queryByTestId("assignment-review-summary")).toBeNull();
    expect(screen.queryByTestId("counterparty-reviewed")).toBeNull();
  });

  it("kazanç satırı yalnız işçi payını yazar; hizmet bedeli ve işveren toplamı çalışan ekranında hiçbir koşulda yok", () => {
    render(<WorkDetailScreen conversationAction={conversationAction} initialDetail={workDetail()} action={vi.fn()} locate={located} />);

    expect(screen.getByText("Kazanç").nextElementSibling).toHaveTextContent("₺1.250,00");
    expect(screen.queryByText(/Hizmet bedeli|İşveren toplamı|Komisyon|Toplam tutar/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/1\.500,00|250,00 ₺/);
  });
});
