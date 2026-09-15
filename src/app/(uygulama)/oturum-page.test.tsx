import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionDetail } from "@/lib/session-detail";
import { ApiError } from "@/server/api/errors";

import EmployerPage from "./isveren/oturum/[sessionId]/page";
import { SessionDetailPage } from "./oturum-page";
import WorkerPage from "./panel/oturum/[sessionId]/page";

const sessionId = "4ace3ee5-f9fd-420c-8926-b35f2b82915a";
const enterShell = vi.hoisted(() => vi.fn());
const getSessionDetail = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const redirect = vi.hoisted(() =>
  vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
);

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/account-settings/session-detail", () => ({ getSessionDetail }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));
vi.mock("next/navigation", async (original) => {
  const actual = await original<typeof import("next/navigation")>();
  return { ...actual, notFound, redirect };
});

const detail: SessionDetail = {
  id: sessionId,
  deviceId: "30c46a8e-3e1b-4c35-b616-550171243a8b",
  deviceType: "IOS",
  deviceName: "iPhone 14 Pro Max · iOS 18.1 · Koala 1.1.0",
  deviceCustomName: null,
  ipAddress: "192.0.2.1",
  location: "İstanbul, TR",
  createdAt: "2026-09-01T12:00:00Z",
  lastAccessedAt: "2026-09-06T12:00:00Z",
  refreshExpiresAt: "2026-10-06T12:00:00Z",
  current: false,
  logins: 7,
  loginHistory: [
    { at: "2026-09-06T12:00:00Z", ipAddress: "192.0.2.1", location: "İstanbul, TR", success: true },
    { at: "2026-09-05T12:00:00Z", ipAddress: "198.51.100.7", location: null, success: false },
  ],
};

const params = Promise.resolve({ sessionId });

describe("oturum ayrıntısı sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { firstName: "Ayşe" }, failure: null });
  });

  it.each([
    ["worker", "/panel/hesap", WorkerPage],
    ["employer", "/isveren/hesap", EmployerPage],
  ] as const)("%s kabuğunda hesap bölümünün kapısını veri okumadan önce taşır", (shell, href, Page) => {
    const route = Page({ params });

    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell, href });
    expect(route.props.children.type).toBe(SessionDetailPage);
    expect(route.props.children.props).toMatchObject({ shell, params });
    expect(enterShell).not.toHaveBeenCalled();
    expect(getSessionDetail).not.toHaveBeenCalled();
  });

  it("dolu ayrıntıyı cihaz, IP, konum, zamanlar, giriş sayısı ve geçmişle çizer", async () => {
    getSessionDetail.mockResolvedValue(detail);

    render(await SessionDetailPage({ shell: "worker", params }));

    expect(
      screen.getByRole("heading", { name: /iPhone 14 Pro Max · iOS 18\.1 · Koala 1\.1\.0/ }),
    ).toBeVisible();
    expect(screen.queryByText("Bu cihaz")).toBeNull();
    const facts = screen.getByRole("region", { name: "Oturum bilgileri" });
    expect(facts).toHaveTextContent("IP adresi192.0.2.1");
    expect(facts).toHaveTextContent("KonumYaklaşık: İstanbul, TR");
    // Fixture UTC 12:00 → İstanbul 15:00.
    expect(facts).toHaveTextContent("Oluşturulma1 Eyl 2026 15:00");
    expect(facts).toHaveTextContent("Son erişim6 Eyl 2026 15:00");
    expect(facts).toHaveTextContent("Süre sonu6 Eki 2026 15:00");
    expect(facts).toHaveTextContent("Toplam giriş7");

    const history = within(screen.getByRole("list", { name: "Giriş denemeleri" })).getAllByRole(
      "listitem",
    );
    expect(history).toHaveLength(2);
    expect(history[0]).toHaveTextContent("6 Eyl 2026 15:00");
    expect(history[0]).toHaveTextContent("192.0.2.1 · Yaklaşık: İstanbul, TR");
    expect(history[0]).toHaveTextContent("Başarılı");
    expect(history[1]).toHaveTextContent("198.51.100.7 · —");
    expect(history[1]).toHaveTextContent("Başarısız");

    expect(screen.getByRole("textbox", { name: "Cihaz adı" })).toHaveAttribute("maxlength", "60");
    expect(screen.getByRole("button", { name: "Cihazı adlandır" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Oturumu kapat" })).toBeVisible();
    expect(screen.getByRole("link", { name: "← Oturumlar ve cihazlar" })).toHaveAttribute(
      "href",
      "/panel/hesap#oturumlar",
    );
    expect(getSessionDetail).toHaveBeenCalledWith(sessionId);
  });

  it("boş alanlarda tire yazar, boş geçmişte kapsam notunu gösterir, mevcut cihazı rozetler", async () => {
    getSessionDetail.mockResolvedValue({
      ...detail,
      deviceName: null,
      deviceType: "WEB_BROWSER",
      deviceCustomName: "Evdeki Mac",
      ipAddress: null,
      location: null,
      createdAt: null,
      current: true,
      logins: 0,
      loginHistory: [],
    });

    render(await SessionDetailPage({ shell: "employer", params }));

    expect(screen.getByRole("heading", { name: /Web tarayıcısı/ })).toBeVisible();
    expect(screen.getByText("Bu cihaz")).toBeVisible();
    const facts = screen.getByRole("region", { name: "Oturum bilgileri" });
    expect(facts).toHaveTextContent("IP adresi—");
    expect(facts).toHaveTextContent("Konum—");
    expect(facts).toHaveTextContent("OluşturulmaTarih yok");
    expect(facts).toHaveTextContent("Toplam giriş0");
    expect(
      screen.getByText("Henüz kayıtlı giriş yok. Geçmiş, güncellemeden sonraki girişleri kapsar."),
    ).toBeVisible();
    expect(screen.queryByRole("list", { name: "Giriş denemeleri" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Cihaz adı" })).toHaveValue("Evdeki Mac");
    // Kendi oturumunu kapatmak çıkış yapmaktır; DELETE yerine /cikis.
    expect(screen.queryByRole("button", { name: "Oturumu kapat" })).toBeNull();
    expect(screen.getByRole("link", { name: "Bu cihazdan çıkış yap" })).toHaveAttribute("href", "/cikis");
    expect(screen.getByRole("link", { name: "← Oturumlar ve cihazlar" })).toHaveAttribute(
      "href",
      "/isveren/hesap#oturumlar",
    );
  });

  it("biçimsiz kimlikte ve bulunamayan oturumda 404 verir", async () => {
    await expect(
      SessionDetailPage({ shell: "worker", params: Promise.resolve({ sessionId: "../admin" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getSessionDetail).not.toHaveBeenCalled();

    // Başkasının oturumu, kapatılmış oturum ve eski sunucu (405) aynı `null`.
    getSessionDetail.mockResolvedValueOnce(null);
    await expect(SessionDetailPage({ shell: "worker", params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("oturumsuz ziyaretçi için veri okumadan girişe düşer", async () => {
    // `enterShell` kapıyı `redirect` ile keser; sayfa o istisnayı yutmamalı.
    enterShell.mockRejectedValue(new Error("REDIRECT:/giris?next=%2Fpanel%2Foturum"));

    await expect(SessionDetailPage({ shell: "worker", params })).rejects.toThrow("REDIRECT:/giris");
    expect(getSessionDetail).not.toHaveBeenCalled();
  });

  it("profil okunamazsa hiçbir şey çizmez; kabuk hata kartını zaten gösteriyor", async () => {
    enterShell.mockResolvedValue({ viewer: null, failure: { errorCode: "UNEXPECTED", httpStatus: 500 } });

    expect(await SessionDetailPage({ shell: "worker", params })).toBeNull();
    expect(getSessionDetail).not.toHaveBeenCalled();
  });

  it("backend hatasını ham mesaj yerine güvenli hata kartıyla gösterir", async () => {
    getSessionDetail.mockRejectedValue(
      new ApiError({
        status: 503,
        errorCode: "EXTERNAL_SERVICE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "internal backend message",
      }),
    );

    render(await SessionDetailPage({ shell: "worker", params }));

    expect(screen.getByRole("alert")).toHaveTextContent("Hizmete ulaşılamıyor");
    expect(screen.queryByText("internal backend message")).toBeNull();
  });
});
