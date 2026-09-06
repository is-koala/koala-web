import { describe, expect, it } from "vitest";

import { appShells, sectionAt } from "./app-routes";
import { privateRouteTrees } from "./private-routes";

describe("kabuk rota kaydı", () => {
  it("işveren menüsünü issue'daki sırayla taşır", () => {
    expect(appShells.employer.sections.map((section) => section.label)).toEqual([
      "Şirketim",
      "İlanlarım",
      "Başvurular",
      "Atamalar",
      "Mesajlar",
      "Ödemeler",
    ]);
  });

  it("her bölüm kendi kabuğunun kökü altında kalır", () => {
    for (const shell of Object.values(appShells)) {
      for (const section of shell.sections) {
        expect(section.href.startsWith(`${shell.root}/`)).toBe(true);
      }
    }
  });

  it("iki kabuk da arama motorlarına kapalı ağaçlarda kayıtlı", () => {
    // Kayıt ile `private-routes.ts` ayrışırsa kabuk indekslenebilir kalır ve
    // bunu kimse fark etmez: menü çalışmaya devam eder.
    expect(Object.values(appShells).map((shell) => shell.root).sort()).toEqual(
      [...privateRouteTrees].sort(),
    );
  });

  it("henüz açılmamış her bölüm nedenini yazılı taşır", () => {
    const planned = Object.values(appShells)
      .flatMap((shell) => shell.sections)
      .filter((section) => section.status === "planned");

    expect(planned.length).toBeGreaterThan(0);
    for (const section of planned) {
      expect(section.note.trim().length).toBeGreaterThan(0);
    }
  });

  it("bildirilmiş bölümü yol parçalarından bulur", () => {
    expect(sectionAt("employer", ["ilanlar"])?.label).toBe("İlanlarım");
    expect(sectionAt("worker", ["mesajlar"])?.label).toBe("Mesajlar");
  });

  it("bildirilmemiş yolu tanımaz", () => {
    // Kayıtta olmayan yol gerçek bir 404'tür; "henüz açılmadı" demek yazım
    // hatasını var olmayan bir bölüm gibi gösterirdi.
    expect(sectionAt("employer", ["bilinmeyen"])).toBeUndefined();
    expect(sectionAt("employer", ["ilanlar", "yeni"])).toBeUndefined();
  });

  it("bir kabuğun bölümünü öbür kabukta tanımaz", () => {
    // İki kabuk birbirinin adreslerini kabul etseydi `/isveren/kazanclarim`
    // sessizce çalışır ve menüde olmayan bir sayfa doğardı.
    expect(sectionAt("worker", ["kazanclarim"])?.label).toBe("Kazançlarım");
    expect(sectionAt("employer", ["kazanclarim"])).toBeUndefined();
  });
});
