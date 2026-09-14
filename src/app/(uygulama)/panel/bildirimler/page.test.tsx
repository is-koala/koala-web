import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import Page, { NotificationsPage } from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const listNotifications = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/account-settings/settings", () => ({ listNotifications }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));
vi.mock("../../hesap-actions", () => ({
  markNotificationReadAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
}));

function feed(overrides: Record<string, unknown> = {}) {
  return {
    unreadCount: 0,
    notifications: {
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
      ...overrides,
    },
  };
}

const notification = {
  id: "5c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
  channel: "IN_APP",
  category: "APPLICATION_UPDATES",
  subject: "Başvurun kabul edildi",
  body: "Etkinlik görevlisi ilanına başvurun kabul edildi.",
  targetType: "JOB_APPLICATION",
  targetId: null,
  status: "SENT",
  sentAt: "2026-09-10T09:00:00Z",
  readAt: null,
};

const searchParams = (sayfa?: string) => Promise.resolve(sayfa === undefined ? {} : { sayfa });

describe("Bildirimler sayfası durumları", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { firstName: "Ayşe" }, failure: null });
  });

  it("çalışan kabuğu kapısını veri okumadan önce taşır", () => {
    const route = Page({ searchParams: searchParams() });

    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell: "worker", href: "/panel/bildirimler" });
    expect(listNotifications).not.toHaveBeenCalled();
  });

  it("bildirim yoksa boş durumu gösterir", async () => {
    listNotifications.mockResolvedValue(feed());

    render(await NotificationsPage({ searchParams: searchParams() }));

    expect(screen.getByRole("heading", { level: 1, name: "Bildirimler" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Henüz bildirimin yok.");
    expect(listNotifications).toHaveBeenCalledWith(0);
  });

  it("bildirimleri kategori etiketiyle listeler ve sayfayı adresten okur", async () => {
    listNotifications.mockResolvedValue({
      ...feed({ content: [notification], page: 1, totalPages: 3, first: false, last: false }),
      unreadCount: 1,
    });

    render(await NotificationsPage({ searchParams: searchParams("2") }));

    expect(listNotifications).toHaveBeenCalledWith(1);
    expect(screen.getByText("Başvurun kabul edildi")).toBeVisible();
    expect(screen.getByText(/Başvuru güncellemeleri/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Daha yeni bildirimler" })).toHaveAttribute(
      "href",
      "/panel/bildirimler",
    );
    expect(screen.getByRole("link", { name: "Daha eski bildirimler" })).toHaveAttribute(
      "href",
      "/panel/bildirimler?sayfa=3",
    );
  });

  it("geçersiz sayfa numarasını ilk sayfaya düşürür", async () => {
    listNotifications.mockResolvedValue(feed());

    render(await NotificationsPage({ searchParams: searchParams("-4") }));

    expect(listNotifications).toHaveBeenCalledWith(0);
  });

  it("backend hatasını ham mesaj yerine koduyla gösterir", async () => {
    listNotifications.mockRejectedValue(
      new ApiError({
        status: 503,
        errorCode: "EXTERNAL_SERVICE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "internal backend message",
      }),
    );

    render(await NotificationsPage({ searchParams: searchParams() }));

    expect(screen.getByRole("alert")).toHaveTextContent("Hizmete ulaşılamıyor");
    expect(screen.queryByText("internal backend message")).toBeNull();
  });

  it("oturum kapısı yönlendirirse bildirim isteğine çıkmaz", async () => {
    enterShell.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(NotificationsPage({ searchParams: searchParams() })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(listNotifications).not.toHaveBeenCalled();
  });
});
