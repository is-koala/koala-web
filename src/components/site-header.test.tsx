import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteHeader } from "./site-header";

const mobileNavItems = [
  ["İş İlanları", "/is-ilanlari"],
  ["İş Arayanlar", "/is-arayanlar"],
  ["İşverenler", "/isverenler"],
  ["Nasıl Çalışır", "/nasil-calisir"],
  ["SSS", "/sss"],
  ["Hakkımızda", "/hakkimizda"],
  ["İletişim", "/iletisim"],
] as const;

function closedSession() {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("tanıtım başlığı", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", closedSession());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mobil menüyü kapalı başlatır ve ekran okuyucuya bildirir", () => {
    render(<SiteHeader />);

    const toggle = screen.getByRole("button", { name: "Menüyü aç" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.getAttribute("aria-controls")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Menü" })).toBeNull();
  });

  it("açılan menüde pazarlama, İletişim ve Hakkımızda bağlantılarını sunar", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(screen.getByRole("button", { name: "Menüyü aç" }));

    const dialog = screen.getByRole("dialog", { name: "Menü" });
    expect(screen.getByRole("button", { name: "Menüyü aç" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    for (const [label, href] of mobileNavItems) {
      expect(within(dialog).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("Escape açık menüyü kapatır", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(screen.getByRole("button", { name: "Menüyü aç" }));
    expect(screen.getByRole("dialog", { name: "Menü" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Menü" })).toBeNull();
    expect(screen.getByRole("button", { name: "Menüyü aç" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("açılınca odağı menüye alır, Escape sonrası düğmeye döner", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const toggle = screen.getByRole("button", { name: "Menüyü aç" });
    await user.click(toggle);

    const dialog = screen.getByRole("dialog", { name: "Menü" });
    expect(within(dialog).getByRole("link", { name: "İş İlanları" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(within(dialog).getByRole("button", { name: "Kapat" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(toggle).toHaveFocus();
  });

  it("Giriş ve Uygulamayı aç bağlantılarını menü açıkken de korur", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(screen.getByRole("button", { name: "Menüyü aç" }));

    expect(screen.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/giris");
    expect(screen.getByRole("link", { name: "Uygulamayı aç" })).toHaveAttribute(
      "href",
      "/uygulamayi-ac",
    );
  });

  it("kapat düğmesi menüyü kapatır", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(screen.getByRole("button", { name: "Menüyü aç" }));
    await user.click(within(screen.getByRole("dialog", { name: "Menü" })).getByRole("button", { name: "Kapat" }));

    expect(screen.queryByRole("dialog", { name: "Menü" })).toBeNull();
    expect(screen.getByRole("button", { name: "Menüyü aç" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("menü bağlantısına basınca paneli kapatır", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(screen.getByRole("button", { name: "Menüyü aç" }));
    await user.click(within(screen.getByRole("dialog", { name: "Menü" })).getByRole("link", { name: "SSS" }));

    expect(screen.queryByRole("dialog", { name: "Menü" })).toBeNull();
  });
});
