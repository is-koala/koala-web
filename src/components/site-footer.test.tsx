import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "./site-footer";

describe("site altbilgisi", () => {
  it("telif satırını yılsız yazar", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("contentinfo")).toHaveTextContent("© Koala");
  });

  it("hiçbir yere yıl yazmıyor", () => {
    // Bu iddia bir kararı tutuyor, bir davranışı değil: yıl telif satırından
    // bilerek çıkarıldı (is-koala/koala-web#90). Tanıtım ve yasal sayfalar
    // statik üretiliyor, yani yıl build anında HTML'e gömülür ve 1 Ocak'tan
    // sonra site yeniden deploy edilene kadar bayat kalırdı.
    //
    // Geri eklemek tek satır ve zararsız görünür — kusur ancak yıl dönümünde,
    // aylar sonra ortaya çıkar. Testin işi o tek satırı bugün durdurmak.
    render(<SiteFooter />);

    expect(screen.getByRole("contentinfo").textContent).not.toMatch(/\d{4}/);
  });

  it("İletişim ve Hakkımızda bağlantılarını genel gezinmeye koyar", () => {
    render(<SiteFooter />);

    const footer = screen.getByRole("contentinfo");
    expect(screen.getByRole("link", { name: "Hakkımızda" })).toHaveAttribute(
      "href",
      "/hakkimizda",
    );
    expect(screen.getByRole("link", { name: "İletişim" })).toHaveAttribute("href", "/iletisim");
    expect(footer).toContainElement(screen.getByRole("link", { name: "Hakkımızda" }));
    expect(footer).toContainElement(screen.getByRole("link", { name: "İletişim" }));
  });
});
