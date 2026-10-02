import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirectTo, throwingRedirect } from "../../../../tests/support/navigation";

import { GET } from "./route";

const readSession = vi.hoisted(() => vi.fn());
const viewerShell = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", async () => ({
  redirect: (await import("../../../../tests/support/navigation")).throwingRedirect(),
}));
vi.mock("@/server/session/session", () => ({ readSession }));
vi.mock("@/server/session/viewer", () => ({ viewerShell }));

describe("bildirim tercihlerine giden rol çözücü adres", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("oturumsuz ziyaretçiyi bu adrese dönecek biçimde girişe gönderir", async () => {
    // Çıkış sayfasındaki bağlantı rolü bilmiyor; giriş sonrası `?next=` buraya
    // döner ve rol burada çözülür.
    readSession.mockResolvedValue({ deviceId: "", accessToken: null, refreshToken: null });

    await expect(GET()).rejects.toThrow(redirectTo("/giris?next=%2Fhesap%2Fbildirimler"));
    expect(viewerShell).not.toHaveBeenCalled();
  });

  it.each([
    ["worker", "/panel/hesap#bildirim-tercihleri"],
    ["employer", "/isveren/hesap#bildirim-tercihleri"],
  ] as const)("%s kullanıcısını kendi kabuğundaki tercihlere bırakır", async (shell, target) => {
    readSession.mockResolvedValue({ deviceId: "d", accessToken: "a", refreshToken: "r" });
    viewerShell.mockResolvedValue(shell);

    await expect(GET()).rejects.toThrow(redirectTo(target));
  });

  it("rol okunamazsa kabuk tahmin etmez, ana sayfaya bırakır", async () => {
    readSession.mockResolvedValue({ deviceId: "d", accessToken: "a", refreshToken: "r" });
    viewerShell.mockResolvedValue(null);

    await expect(GET()).rejects.toThrow(redirectTo("/"));
  });

  it("oturum render ortasında biterse profil okuyucusunun yönlendirmesini yutmaz", async () => {
    readSession.mockResolvedValue({ deviceId: "d", accessToken: "a", refreshToken: "r" });
    const expired = throwingRedirect();
    viewerShell.mockImplementation(() => expired("/giris?next=%2Fhesap%2Fbildirimler"));

    await expect(GET()).rejects.toThrow(redirectTo("/giris?next=%2Fhesap%2Fbildirimler"));
  });
});
