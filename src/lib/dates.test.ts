import { describe, expect, it, vi, afterEach } from "vitest";

import { formatDate, formatDateTime, formatJobDate, isFormattableDate, monthName } from "./dates";

/** Sunucunun kendi saat dilimini taklit eden testler bunu kirletiyor. */
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

  it("saatsiz biçim aynı günü yazar", () => {
    expect(formatDate(instant)).toBe("6 Eyl 2026");
  });

  it("saatsiz biçim de saat dilimini sabitler", async () => {
    // Aynı sabit, ayrı bir giriş: saati göstermeyen biçim gece yarısını
    // geçen anda **günü** kaydırarak ayrışırdı ve kimse saatten anlamazdı.
    for (const hostileZone of ["UTC", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      process.env.TZ = hostileZone;

      expect(Intl.DateTimeFormat().resolvedOptions().timeZone, hostileZone).toBe(
        hostileZone,
      );

      expect(formatDate(instant), hostileZone).toBe("6 Eyl 2026");
      expect(formatDate(lateInstant), hostileZone).toBe("7 Eyl 2026");

      vi.resetModules();
      const reloaded = await import("./dates");
      expect(reloaded.formatDate(lateInstant), hostileZone).toBe("7 Eyl 2026");
    }
  });

  it("saatsiz biçim de ayrıştıramadığı değeri geri verir", () => {
    expect(formatDate("bozuk-tarih")).toBe("bozuk-tarih");
    expect(formatDate("")).toBe("");
  });

  it("ayrıştırılabilirliği ayrıca söyler", () => {
    // `<time dateTime={...}>` kuran ve kendi bekleme metnini yazan ekranlar
    // bu soruyu biçimlendirmeden önce soruyor.
    expect(isFormattableDate(instant)).toBe(true);
    expect(isFormattableDate("bozuk-tarih")).toBe(false);
    expect(isFormattableDate("")).toBe(false);
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
