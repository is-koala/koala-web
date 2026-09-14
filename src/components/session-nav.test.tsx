import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionNav } from "./session-nav";

function sessionResponse(body: Record<string, unknown>) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("başlıktaki oturum bağlantısı", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("durum okunmadan önce girişi gösterir", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    render(<SessionNav />);

    expect(screen.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/giris");
    expect(screen.queryByRole("link", { name: /panelim/i })).toBeNull();
  });

  it("çalışan oturumunda Panelim ve çıkış bağlantılarını taşır", async () => {
    vi.stubGlobal("fetch", sessionResponse({ authenticated: true, shell: "worker" }));

    render(<SessionNav />);

    expect(await screen.findByRole("link", { name: "Panelim" })).toHaveAttribute("href", "/panel");
    expect(screen.getByRole("link", { name: "Çıkış" })).toHaveAttribute("href", "/cikis");
    expect(screen.queryByRole("link", { name: "Giriş yap" })).toBeNull();
  });

  it("işveren oturumunda İşveren panelim bağlantısını taşır", async () => {
    vi.stubGlobal("fetch", sessionResponse({ authenticated: true, shell: "employer" }));

    render(<SessionNav />);

    expect(await screen.findByRole("link", { name: "İşveren panelim" })).toHaveAttribute(
      "href",
      "/isveren",
    );
    expect(screen.queryByRole("link", { name: "Panelim" })).toBeNull();
  });

  it("kabuk okunamadıysa çalışan paneline düşer", async () => {
    // Profil arızası oturumu kapatmaz; her oturum `/panel`e girebiliyor.
    vi.stubGlobal("fetch", sessionResponse({ authenticated: true, shell: null }));

    render(<SessionNav />);

    expect(await screen.findByRole("link", { name: "Panelim" })).toHaveAttribute("href", "/panel");
  });

  it("oturum kapalıyken girişte kalır", async () => {
    const fetchMock = sessionResponse({ authenticated: false, shell: null });
    vi.stubGlobal("fetch", fetchMock);

    render(<SessionNav />);

    expect(await screen.findByRole("link", { name: "Giriş yap" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /panelim/i })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/session", expect.anything());
  });

  it("durum sorulamazsa giriş bağlantısıyla ayakta kalır", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ağ yok")));

    render(<SessionNav />);

    expect(await screen.findByRole("link", { name: "Giriş yap" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /panelim/i })).toBeNull();
  });
});
