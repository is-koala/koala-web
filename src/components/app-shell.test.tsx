import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AppShell as AppShellDefinition } from "@/lib/app-routes";
import { appShells } from "@/lib/app-routes";
import type { Viewer } from "@/server/session/viewer";

import { AppShell, SectionNotOpen } from "./app-shell";

const viewer: Viewer = {
  firstName: "Ayşe",
  displayName: "Ayşe Yıldız",
  isEmployer: true,
  identityVerified: true,
  hasIdentityNumber: true,
  hasAddress: true,
  companies: [],
};

const mixedShell: AppShellDefinition = {
  id: "employer",
  root: "/isveren",
  title: "İşveren",
  description: "Kısa açıklama.",
  sections: [
    { href: "/isveren/ilanlar", label: "İlanlarım", status: "ready" },
    {
      href: "/isveren/odemeler",
      label: "Ödemeler",
      status: "planned",
      note: "Ödeme özeti henüz açılmadı.",
    },
  ],
};

describe("oturumlu uygulama kabuğu", () => {
  it("teslim edilmiş bölümü bağlantı, edilmemişi tıklanamaz madde olarak çizer", () => {
    render(
      <AppShell shell={mixedShell} context={{ viewer, failure: null }}>
        <p>sayfa içeriği</p>
      </AppShell>,
    );

    const menu = screen.getByRole("navigation", { name: "İşveren menüsü" });
    expect(within(menu).getByRole("link", { name: "İlanlarım" })).toHaveAttribute(
      "href",
      "/isveren/ilanlar",
    );
    expect(within(menu).queryByRole("link", { name: "Ödemeler" })).toBeNull();
  });

  it("açılmamış bölümün nedenini ekranda yazar", () => {
    render(
      <AppShell shell={mixedShell} context={{ viewer, failure: null }}>
        <p>sayfa içeriği</p>
      </AppShell>,
    );

    expect(screen.getByText("Ödeme özeti henüz açılmadı.")).toBeVisible();
  });

  it("kullanıcının adını ve çıkış yolunu üst barda taşır", () => {
    render(
      <AppShell shell={appShells.employer} context={{ viewer, failure: null }}>
        <p>sayfa içeriği</p>
      </AppShell>,
    );

    expect(screen.getByText("Ayşe Yıldız")).toBeVisible();
    expect(screen.getByRole("link", { name: "Çıkış" })).toHaveAttribute("href", "/cikis");
  });

  it("profil okunamadığında menüyü çizmez ve nedenini errorCode'dan üretir", () => {
    render(
      <AppShell
        shell={appShells.employer}
        context={{ viewer: null, failure: { status: 503, errorCode: "EXTERNAL_SERVICE" } }}
      >
        <p>sayfa içeriği</p>
      </AppShell>,
    );

    // Çözülemeyen profil menüsüz kabuk demek: var olmayan bir kapıyı işaret
    // eden bağlantı, hiç bağlantı olmamasından kötüdür.
    expect(screen.queryByRole("navigation", { name: "İşveren menüsü" })).toBeNull();
    expect(screen.queryByText("İlanlarım")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Hizmete ulaşılamıyor");
    // Backend'in ham mesajı değil, `errorCode`dan çözülen Türkçe metin.
    expect(screen.queryByText(/Servise ulasilamiyor/)).toBeNull();
    // Kullanıcı yine de çıkabilmeli; kapı çözülemedi diye kilitlenmez.
    expect(screen.getByRole("link", { name: "Çıkış" })).toBeVisible();
  });

  it("sayfa içeriğini kabuğun altında sürdürür", () => {
    render(
      <AppShell shell={appShells.worker} context={{ viewer, failure: null }}>
        <p>sayfa içeriği</p>
      </AppShell>,
    );

    expect(within(screen.getByRole("main")).getByText("sayfa içeriği")).toBeVisible();
  });

  it("açılmamış bölümün adresi 404 değil, nedeni yazılı bir ekran verir", () => {
    render(
      <SectionNotOpen
        section={{
          href: "/isveren/odemeler",
          label: "Ödemeler",
          status: "planned",
          note: "Ödeme özeti henüz açılmadı.",
        }}
      />,
    );

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Ödemeler");
    expect(notice).toHaveTextContent("Ödeme özeti henüz açılmadı.");
  });

  it("rol değiştirici sunmaz", () => {
    // Ürün sahibi "web'de rol değiştirilebilir mi?" sorusunu henüz
    // cevaplamadı (is-koala/koala-web#25). Karar gelmeden konan bir geçiş
    // bağlantısı, geri alınması pahalı bir ürün kararını sessizce vermek olur.
    render(
      <AppShell shell={appShells.employer} context={{ viewer, failure: null }}>
        <p>sayfa içeriği</p>
      </AppShell>,
    );

    expect(
      screen.queryAllByRole("link").filter((link) => link.getAttribute("href") === "/panel"),
    ).toEqual([]);
  });
});
