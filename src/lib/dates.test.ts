import { describe, expect, it, vi, afterEach } from "vitest";

import {
  currentDisplayYear,
  formatDateTime,
  formatJobDate,
  isFormattableDate,
  monthName,
} from "./dates";

/** Sunucunun kendi saat dilimini taklit eden testler bunu kirletiyor. */
const originalTimeZone = process.env.TZ;

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
  // Yıl testleri saati sahteleyerek kirletiyor; bırakılan sahte saat bu
  // dosyanın geri kalanını değil, aynı işçide koşan başka dosyaları vurur.
  vi.useRealTimers();
  vi.resetModules();
});

/** Backend'in gönderdiği biçim: gerçek bir an, UTC işaretli. */
const instant = "2026-09-06T10:00:00Z";

/** Gece yarısını geçiren an: yanlış saat diliminde **gün** de kayar. */
const lateInstant = "2026-09-06T22:00:00Z";

describe("an biçimlendirme", () => {
  it("tarihi ve saati Türkçe kısa biçimde yazar", () => {
    expect(formatDateTime(instant)).toBe("6 Eyl 2026 13:00");
  });

  it("saat dilimini sunucunun TZ'sinden bağımsız sabitler", async () => {
    // Sunucu ile tarayıcı aynı anı farklı saat dilimiyle yazarsa ekranda
    // önce bir metin, hidrasyondan sonra başka bir metin görünür. Bu yüzden
    // biçimlendirici ortamın saat dilimine hiç bakmamalı.
    for (const hostileZone of ["UTC", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      process.env.TZ = hostileZone;

      // Denemenin uygulandığının kanıtı: `process.env.TZ` bir gün çalışma
      // anında ICU'ya ulaşmaz olursa aşağıdaki iddialar sessizce ev
      // dilimini ölçmeye başlar ve test yalan yere yeşil kalır.
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone, hostileZone).toBe(
        hostileZone,
      );

      expect(formatDateTime(instant), hostileZone).toBe("6 Eyl 2026 13:00");
      expect(formatDateTime(lateInstant), hostileZone).toBe("7 Eyl 2026 01:00");

      // Modül yeniden değerlendiriliyor: biçimlendirici bir gün modül
      // yüklenirken bir kez kurulursa, çalışma anında TZ değiştirmek onu
      // yakalayamaz ve yukarıdaki iki satır yalan yere yeşil kalırdı.
      vi.resetModules();
      const reloaded = await import("./dates");
      expect(reloaded.formatDateTime(instant), hostileZone).toBe("6 Eyl 2026 13:00");
      expect(reloaded.formatDateTime(lateInstant), hostileZone).toBe("7 Eyl 2026 01:00");
    }
  });

  it("ayrıştıramadığı değeri olduğu gibi geri verir", () => {
    // Ham metin, "Invalid Date" yazısından çok daha fazlasını söylüyor.
    expect(formatDateTime("bozuk-tarih")).toBe("bozuk-tarih");
    expect(formatDateTime("")).toBe("");
    expect(formatDateTime("2026-13-45T99:99:99Z")).toBe("2026-13-45T99:99:99Z");
  });

  it("ayrıştırılabilirliği ayrıca söyler", () => {
    // `<time dateTime={...}>` kuran ve kendi bekleme metnini yazan ekranlar
    // bu soruyu biçimlendirmeden önce soruyor.
    expect(isFormattableDate(instant)).toBe(true);
    expect(isFormattableDate("bozuk-tarih")).toBe(false);
    expect(isFormattableDate("")).toBe(false);
  });
});

/**
 * 31 Aralık 2026 21:30 UTC: İstanbul çoktan 1 Ocak 2027 00:30, sunucunun
 * `UTC` saati hâlâ 2026. Üretimde yılda üç saat açık kalan pencere bu.
 */
const afterIstanbulNewYear = "2026-12-31T21:30:00Z";

/**
 * 31 Aralık 2026 11:00 UTC: İstanbul hâlâ 31 Aralık 2026 14:00 ama
 * `Pacific/Kiritimati` (UTC+14) 1 Ocak 2027'ye geçmiş. Pencerenin ters yönü —
 * sabit yalnız "geri kalanlar" için değil, "önden gidenler" için de gerek.
 */
const beforeIstanbulNewYear = "2026-12-31T11:00:00Z";

describe("içinde bulunulan yıl", () => {
  it("sıradan bir günde takvim yılını verir", () => {
    vi.setSystemTime(new Date(instant));
    expect(currentDisplayYear()).toBe(2026);
  });

  it("yıl sınırında sunucunun TZ'sinden bağımsız İstanbul yılını verir", async () => {
    // Saat sahteleniyor: gerçek zamanda bu iddia yılda yalnız birkaç saat bir
    // şey ölçer, geri kalan zaman her saat dilimi aynı yılı yazar ve test
    // hiçbir şeyi bağlamadan yeşil kalır.
    for (const [moment, expectedYear, hostileZones] of [
      [afterIstanbulNewYear, 2027, ["UTC", "America/Los_Angeles"]],
      [beforeIstanbulNewYear, 2026, ["Pacific/Kiritimati"]],
    ] as const) {
      vi.setSystemTime(new Date(moment));

      for (const hostileZone of hostileZones) {
        process.env.TZ = hostileZone;

        // Denemenin uygulandığının kanıtı: `process.env.TZ` bir gün çalışma
        // anında ICU'ya ulaşmaz olursa aşağıdaki iddialar sessizce ev
        // dilimini — zaten Europe/Istanbul — ölçmeye başlar ve test yalan
        // yere yeşil kalır.
        expect(Intl.DateTimeFormat().resolvedOptions().timeZone, hostileZone).toBe(
          hostileZone,
        );

        // Seçilen anın gerçekten ısırdığının kanıtı: düşman dilim bu anda
        // başka bir yıl yazmıyorsa iddianın ayırt ettiği bir şey yok.
        expect(new Date().getFullYear(), hostileZone).not.toBe(expectedYear);

        expect(currentDisplayYear(), hostileZone).toBe(expectedYear);

        // Modül yeniden değerlendiriliyor: biçimlendirici bir gün modül
        // yüklenirken bir kez kurulursa, çalışma anında TZ değiştirmek onu
        // yakalayamaz ve yukarıdaki satır yalan yere yeşil kalırdı.
        vi.resetModules();
        const reloaded = await import("./dates");
        expect(reloaded.currentDisplayYear(), hostileZone).toBe(expectedYear);
      }
    }
  });
});

describe("iş takvimi tarihi", () => {
  it("ayı Türkçe adıyla, günü baştaki sıfır olmadan yazar", () => {
    expect(formatJobDate("2026-09-12T09:00:00")).toBe("12 Eylül 2026");
    expect(formatJobDate("2026-01-01T00:00:00")).toBe("1 Ocak 2026");
  });

  it("ofsetsiz duvar saatini saat dilimine göre kaydırmaz", () => {
    // `startsAt` bir an değil, üzerinde anlaşılmış yerel saat. `new Date(...)`
    // ile okunsaydı gece yarısına yakın işler bir gün öne ya da arkaya
    // düşerdi; testler bu yüzden iki uç saat dilimini de deniyor.
    for (const hostileZone of ["UTC", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      process.env.TZ = hostileZone;

      // Denemenin uygulandığının kanıtı: `process.env.TZ` bir gün çalışma
      // anında ICU'ya ulaşmaz olursa aşağıdaki iddialar sessizce ev
      // dilimini ölçmeye başlar ve test yalan yere yeşil kalır.
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone, hostileZone).toBe(
        hostileZone,
      );

      expect(formatJobDate("2026-09-12T23:30:00"), hostileZone).toBe("12 Eylül 2026");
      expect(formatJobDate("2026-09-12T00:30:00"), hostileZone).toBe("12 Eylül 2026");
    }
  });

  it("beklediği biçimde olmayan değeri uydurmadan geri verir", () => {
    expect(formatJobDate("bozuk-tarih")).toBe("bozuk-tarih");
    expect(formatJobDate("")).toBe("");
  });

  it("ay adlarını 1 tabanlı numaradan verir", () => {
    expect(monthName(1)).toBe("Ocak");
    expect(monthName(12)).toBe("Aralık");
  });
});
