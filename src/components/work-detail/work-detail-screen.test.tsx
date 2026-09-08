import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  WorkDetail,
  WorkDetailAction,
} from "@/assignments/work-detail";
import type { LocationCapture } from "@/assignments/geolocation";

import { WorkDetailScreen } from "./work-detail-screen";

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
      assignedAt: "2026-09-06T10:00:00Z",
      completedAt: null,
    },
    description: "Misafirleri karşıla.",
    duties: "Yaka kartlarını dağıt.",
    dressCode: "Siyah gömlek",
    fullAddress: "Caferağa Mahallesi, Moda Caddesi No: 12/4",
    sessions: [{
      id: "4b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
      checkInAt: "2026-09-11T09:00:00Z",
      checkOutAt: "2026-09-11T10:30:00Z",
      minutes: 90,
    }],
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

  it("sunucu ayrıntısını, kesin adresi, zaman çizelgesini ve toplam süreyi gösterir", () => {
    const action = vi.fn<WorkDetailAction>();
    render(<WorkDetailScreen initialDetail={workDetail()} action={action} locate={located} />);

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
    render(<WorkDetailScreen initialDetail={open} action={vi.fn()} locate={located} />);

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
      <WorkDetailScreen initialDetail={open} action={vi.fn()} locate={located} />,
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
    render(<WorkDetailScreen initialDetail={workDetail()} action={action} locate={locate} />);

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
    // Konum uyarısı action sonucundaki yeni iş ayrıntısından önce çizilebilir.
    // Yenilenen oturumun düğmesini ayrıca bekleyerek transition yarışını önle.
    expect(await screen.findByRole("button", { name: "İşten çıkış yap" })).toBeVisible();
  });

  it("güvensiz bağlam sonucunda konumsuz devam uyarısını açıklar", async () => {
    const user = userEvent.setup();
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({ status: "done", detail: workDetail() });
    const locate = vi.fn(async (): Promise<LocationCapture> => ({
      status: "unavailable",
      reason: "insecure",
      point: null,
    }));
    render(<WorkDetailScreen initialDetail={workDetail()} action={action} locate={locate} />);

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
    render(<WorkDetailScreen initialDetail={workDetail()} action={action} locate={located} />);

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
    render(<WorkDetailScreen initialDetail={open} action={action} locate={located} />);

    await user.click(screen.getByRole("button", { name: "İşten çıkış yap" }));

    expect(action).toHaveBeenCalledWith({
      type: "checkpoint",
      kind: "check-out",
      point: { latitude: 40.98, longitude: 29.02 },
    });
    expect(await screen.findByText("Toplam 1 sa 7 dk")).toBeVisible();
    expect(screen.getByText("1 sa 7 dk")).toBeVisible();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByRole("button", { name: "İşe giriş yap" })).toBeVisible();
  });

  it("odak ve görünürlük dönüşlerinde sunucuyu yeniler; kaybolan tam adresi tutmaz", async () => {
    const withoutAddress = workDetail({ fullAddress: null });
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({ status: "done", detail: withoutAddress });
    render(<WorkDetailScreen initialDetail={workDetail()} action={action} locate={located} />);

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
    render(<WorkDetailScreen initialDetail={initial} action={action} locate={located} />);

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
    render(<WorkDetailScreen initialDetail={workDetail()} action={action} locate={located} />);

    fireEvent.focus(window);

    expect(await screen.findByRole("alert")).toHaveTextContent("Aradığın kayıt artık mevcut olmayabilir.");
    expect(screen.queryByText("Caferağa Mahallesi, Moda Caddesi No: 12/4")).toBeNull();
    expect(screen.getByRole("link", { name: "İşlerime dön" })).toHaveAttribute("href", "/panel/islerim");
  });

  it("iptal, uyuşmazlık ve değerlendirme aksiyonlarını yalnız uygun durumda gösterir", async () => {
    const user = userEvent.setup();
    const action = vi.fn<WorkDetailAction>().mockResolvedValue({ status: "done", detail: workDetail() });
    const { rerender } = render(
      <WorkDetailScreen initialDetail={workDetail()} action={action} locate={located} />,
    );

    expect(screen.getByText("İptal önizlemesi")).toBeVisible();
    await user.click(screen.getByText("İptal önizlemesi"));
    expect(screen.getByText("Başlangıca kalan").closest("div")).toHaveTextContent("Başlangıca kalan2 sa");
    expect(screen.getByText(/çalışmadan çekilmiş olursun/i)).toBeVisible();
    expect(screen.queryByText("Kesinti")).toBeNull();
    expect(screen.queryByText("İşverene iade")).toBeNull();
    expect(screen.getByText("Uyuşmazlık aç")).toBeVisible();
    expect(screen.queryByText("Değerlendirme bırak")).toBeNull();

    await user.click(screen.getByText("Uyuşmazlık aç"));
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
    rerender(<WorkDetailScreen key="completed" initialDetail={completed} action={action} locate={located} />);
    expect(screen.queryByText("İptal önizlemesi")).toBeNull();
    expect(screen.queryByText("Uyuşmazlık aç")).toBeNull();
    expect(screen.getByText("Değerlendirme bırak")).toBeVisible();
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

    render(<WorkDetailScreen initialDetail={closed} action={vi.fn()} locate={located} />);

    await user.click(screen.getByText("İptal önizlemesi"));

    expect(screen.getByText("Başlangıca kalan").closest("div")).toHaveTextContent("Başlangıca kalan2 sa");
    expect(screen.getByRole("button", { name: "Atamayı iptal et" })).toBeDisabled();
    expect(screen.getByLabelText("İptal nedeni")).toBeDisabled();
    expect(screen.getByText(/şu anda bu atamadan çekilemezsin/i)).toBeVisible();
    // İşçi işverenin rakamlarını görmüyor: kesinti ve iade sunucuda kesiliyor.
    expect(screen.queryByText("Kesinti")).toBeNull();
    expect(screen.queryByText("İade")).toBeNull();
  });

  it("iptal açıkken gerekçe metnini yazmaz", async () => {
    // Kapalılık gerekçesi yalnız kapalıyken duruyor; her zaman çizilseydi
    // düğmenin açık olduğu ekranda da "çekilemezsin" yazardı.
    const user = userEvent.setup();
    render(<WorkDetailScreen initialDetail={workDetail()} action={vi.fn()} locate={located} />);

    await user.click(screen.getByText("İptal önizlemesi"));

    expect(screen.getByRole("button", { name: "Atamayı iptal et" })).toBeEnabled();
    expect(screen.getByLabelText("İptal nedeni")).toBeEnabled();
    expect(screen.queryByText(/şu anda bu atamadan çekilemezsin/i)).toBeNull();
  });

  it("açık uyuşmazlık varken çalışana ikinci uyuşmazlık formu göstermez", () => {
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
        }],
      },
    });

    render(<WorkDetailScreen initialDetail={activeDispute} action={vi.fn()} locate={located} />);

    expect(screen.queryByRole("button", { name: "Uyuşmazlığı gönder" })).toBeNull();
    // İptal bloğu da çizilmiyor: nedeni yukarıdaki kalıcı uyuşmazlık şeridinde
    // zaten yazılı, blok içinde ikinci kez tekrar edilmesi gerekmiyor.
    expect(screen.queryByText("İptal önizlemesi")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("açık bir uyuşmazlık var");
  });
});
