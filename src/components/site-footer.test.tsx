import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteFooter } from "./site-footer";

/** Düşman saat dilimi ve sahte saat denemeleri bunları kirletiyor. */
const originalTimeZone = process.env.TZ;

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
  vi.useRealTimers();
});

/**
 * Altbilgi bir sunucu bileşeni: ilk HTML'i Next.js sunucuda çiziyor, sonra
 * tarayıcı aynı ağacı hidrasyonla ele alıyor. Üretimde sunucu kapsayıcıda
 * `TZ=UTC` ile koşuyor, yani telif yılı ortamın dilimine bırakılırsa yılbaşı
 * gecesi iki taraf iki ayrı yıl yazar.
 *
 * **Bu dosyadaki iddiaların ısırması düşman saat dilimine bağlı.** Testin ev
 * dilimi zaten `Europe/Istanbul`; düşman dilim kurulmadan yazılan bir yıl
 * iddiası, sabit tamamen kaldırılsa bile yeşil kalır ve hiçbir şey ölçmez.
 */
describe("site altbilgisi", () => {
  it("yılbaşı gecesi sunucunun UTC saatine değil İstanbul yılına bakar", () => {
    // 31 Aralık 2026 21:30 UTC — İstanbul çoktan 1 Ocak 2027 00:30.
    vi.setSystemTime(new Date("2026-12-31T21:30:00Z"));
    process.env.TZ = "UTC";

    // Denemenin uygulandığının kanıtı: `process.env.TZ` bir gün çalışma
    // anında ICU'ya ulaşmaz olursa aşağıdaki iddia sessizce ev dilimini
    // ölçmeye başlar ve test yalan yere yeşil kalır.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
    // Anın gerçekten ısırdığının kanıtı: sunucunun dilimi hâlâ eski yılda.
    expect(new Date().getFullYear()).toBe(2026);

    render(<SiteFooter />);

    expect(screen.getByRole("contentinfo")).toHaveTextContent("© 2027 Koala");
  });

  it("İstanbul yeni yıla girmeden önden giden bir dilime uymaz", () => {
    // 31 Aralık 2026 11:00 UTC — İstanbul 31 Aralık 2026 14:00, ama
    // `Pacific/Kiritimati` (UTC+14) 1 Ocak 2027'de. Ters yön de kapalı olmalı:
    // sabit yalnız sunucunun geride kalmasına karşı değil, öne geçmesine karşı
    // da duruyor.
    vi.setSystemTime(new Date("2026-12-31T11:00:00Z"));
    process.env.TZ = "Pacific/Kiritimati";

    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Pacific/Kiritimati");
    expect(new Date().getFullYear()).toBe(2027);

    render(<SiteFooter />);

    expect(screen.getByRole("contentinfo")).toHaveTextContent("© 2026 Koala");
  });

  it("yasal metinlere ve hesap silmeye bağlantı verir", () => {
    render(<SiteFooter />);

    const footer = screen.getByRole("contentinfo");
    expect(screen.getByRole("link", { name: "Hesap Silme" })).toHaveAttribute(
      "href",
      "/hesap-silme",
    );
    expect(screen.getByRole("link", { name: "Kullanım Koşulları" })).toHaveAttribute(
      "href",
      "/kullanim-kosullari",
    );
    expect(footer).toHaveTextContent("Bugünün işi, bugünün insanı.");
  });
});
