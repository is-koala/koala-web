import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionNav } from "./session-nav";

function sessionResponse(authenticated: boolean) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ authenticated }), {
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
    expect(screen.queryByRole("link", { name: "İşlerim" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Şirketim" })).toBeNull();
  });

  it("oturum açıkken çıkışa bağlar", async () => {
    vi.stubGlobal("fetch", sessionResponse(true));

    render(<SessionNav />);

    expect(await screen.findByRole("link", { name: "Çıkış" })).toHaveAttribute("href", "/cikis");
  });

  it("oturum açıkken İşlerim ve Şirketim bağlantılarını taşır", async () => {
    vi.stubGlobal("fetch", sessionResponse(true));

    render(<SessionNav />);

    expect(await screen.findByRole("link", { name: "İşlerim" })).toHaveAttribute(
      "href",
      "/panel/islerim",
    );
    expect(screen.getByRole("link", { name: "Şirketim" })).toHaveAttribute(
      "href",
      "/isveren/sirket",
    );
    expect(screen.getByRole("link", { name: "Çıkış" })).toHaveAttribute("href", "/cikis");
  });

  it("oturum kapalıyken girişte kalır", async () => {
    const fetchMock = sessionResponse(false);
    vi.stubGlobal("fetch", fetchMock);

    render(<SessionNav />);

    expect(await screen.findByRole("link", { name: "Giriş yap" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "İşlerim" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Şirketim" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/session", expect.anything());
  });

  it("durum sorulamazsa giriş bağlantısıyla ayakta kalır", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ağ yok")));

    render(<SessionNav />);

    expect(await screen.findByRole("link", { name: "Giriş yap" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "İşlerim" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Şirketim" })).toBeNull();
  });
});
