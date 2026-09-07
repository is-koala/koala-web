import { afterEach, describe, expect, it, vi } from "vitest";

import { formatAccountDate } from "./presentation";

/** Düşman saat dilimi denemesi bunu kirletiyor. */
const originalTimeZone = process.env.TZ;

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
  vi.resetModules();
});

/** Backend'in gönderdiği biçim: gerçek bir an, UTC işaretli. */
const instant = "2026-09-06T10:00:00Z";

/** Gece yarısını geçiren an: yanlış saat diliminde **gün** de kayar. */
const lateInstant = "2026-09-06T22:00:00Z";

describe("hesap ayarlarındaki tarih", () => {
  it("tarihi ve saati Türkçe kısa biçimde yazar", () => {
    expect(formatAccountDate(instant)).toBe("6 Eyl 2026 13:00");
  });

  /**
   * Sabitin kendisi `@/lib/dates`'te ve orada zaten kanıtlı; buradaki iddia
   * ondan farklı bir şeyi bağlıyor: **bu ekranın** metninin oradan geldiğini.
   * Ekran kendi `Intl.DateTimeFormat`'ını kurmaya dönerse — bu düzeltmeden
   * önceki hâli — `dates.test.ts` yeşil kalır ve kimse fark etmez. Tek düşman
   * dilim yetiyor; sabitin genel olarak tuttuğunu tarttırmak paylaşılan
   * modülün testinin işi.
   */
  it("saat dilimini sunucunun TZ'sinden bağımsız sabitler", async () => {
    // Bu iki ekran istemci bileşeni ama ilk HTML'i Next.js sunucuda çiziyor.
    // Sunucunun TZ'si Europe/Istanbul değilse (kapsayıcı imajlarında olağan
    // hâli UTC) sunucu bir saat, tarayıcı başka bir saat yazar ve hidrasyon
    // ayrışır.
    // Üretimin fiilî koşulu: sunucu kapsayıcıda `TZ=UTC` ile koşuyor.
    process.env.TZ = "UTC";

    // Denemenin gerçekten uygulandığının kanıtı. Bir gün `process.env.TZ`
    // ataması çalışma anında ICU'yu değiştirmez olursa aşağıdaki üç iddia da
    // sessizce satır 23'ün kopyasına düşer ve testin ölçtüğü şey buharlaşır.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");

    expect(formatAccountDate(instant)).toBe("6 Eyl 2026 13:00");
    expect(formatAccountDate(lateInstant)).toBe("7 Eyl 2026 01:00");

    // Modül yeniden değerlendiriliyor: biçimlendirici bir gün modül
    // yüklenirken bir kez kurulursa, çalışma anında TZ değiştirmek onu
    // yakalayamaz ve yukarıdaki iki satır yalan yere yeşil kalırdı.
    vi.resetModules();
    const reloaded = await import("./presentation");
    expect(reloaded.formatAccountDate(instant)).toBe("6 Eyl 2026 13:00");
  });

  it("değer yokken ve ayrıştırılamazken kendi bekleme metnini yazar", () => {
    // Paylaşılan biçimlendirici ham değeri geri veriyor; bu ekran onu
    // göstermek yerine "Tarih yok" diyor. Bir ekran kararı, biçimlendirme
    // kararı değil — paylaşılan modüle geçerken korunması gereken şey bu.
    //
    // `null` ayrı duruyor çünkü `new Date(null).getTime()` 0'dır, `NaN`
    // değil: yalnız `isFormattableDate`'e sorulsaydı ekrana 1970 düşerdi.
    expect(formatAccountDate(null)).toBe("Tarih yok");
    expect(formatAccountDate("")).toBe("Tarih yok");
    expect(formatAccountDate("bozuk-tarih")).toBe("Tarih yok");
    expect(formatAccountDate("2026-13-45T99:99:99Z")).toBe("Tarih yok");
  });
});
