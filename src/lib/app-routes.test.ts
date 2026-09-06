import { describe, expect, it } from "vitest";

import { appShells, sectionAt } from "./app-routes";
import { gateModes } from "./gates";
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
      "Hesap ve ayarlar",
    ]);
  });

  it("hesap ve ayarları iki kabukta da aynı kalıcı bölüm adıyla açar", () => {
    expect(sectionAt("worker", ["hesap"])).toEqual({
      href: "/panel/hesap",
      label: "Hesap ve ayarlar",
      status: "ready",
    });
    expect(sectionAt("employer", ["hesap"])).toEqual({
      href: "/isveren/hesap",
      label: "Hesap ve ayarlar",
      status: "ready",
    });
  });

  it("profil bölümünü hazır iş arayan rotası olarak bildirir", () => {
    expect(sectionAt("worker", ["profil"])).toEqual({
      href: "/panel/profil",
      label: "Profilim",
      requires: [],
      status: "ready",
    });
  });

  it("mesajlaşmayı iki kabukta da hazır bölüm olarak bildirir", () => {
    expect(sectionAt("worker", ["mesajlar"])).toEqual({
      href: "/panel/mesajlar",
      label: "Mesajlar",
      requires: [],
      status: "ready",
    });
    expect(sectionAt("employer", ["mesajlar"])).toEqual({
      href: "/isveren/mesajlar",
      label: "Mesajlar",
      requires: [],
      status: "ready",
    });
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

  it("her kabuk ve her bölüm istediği kapıları yazılı bildirir", () => {
    // `requires` isteğe bağlı olsaydı yeni bir bölüm kapısını sessizce
    // atlardı; tip onu yazmadan bölüm eklenmesine izin vermiyor.
    for (const shell of Object.values(appShells)) {
      expect(Array.isArray(shell.requires), shell.id).toBe(true);
      for (const section of shell.sections) {
        expect(Array.isArray(section.requires), section.href).toBe(true);
      }
    }
  });

  it("işveren kabuğu kimlik kapısını kabuk düzeyinde bildirir", () => {
    // Kimlik şeridi tek bir bölümün değil kabuğun tamamının işi: üç ayrı
    // backend kapısı ona bakıyor ve kullanıcı hangi bölümde olursa olsun aynı
    // eksiği taşıyor.
    expect(appShells.employer.requires).toContain("identityVerification");
  });

  it("ödemeler bölümü kimlik numarası kapısını da bildirir", () => {
    // `JobAssignmentManager.java:212` iki koşul arıyor; yalnız
    // `identityVerified` bildiren bir bölüm kullanıcıyı 400'e sürerdi.
    expect(sectionAt("employer", ["odemeler"])?.requires).toEqual([
      "identityVerification",
      "identityNumber",
    ]);
  });

  it("bildirilen her kapı sözlükte tanımlı", () => {
    const declared = Object.values(appShells).flatMap((shell) => [
      ...shell.requires,
      ...shell.sections.flatMap((section) => section.requires),
    ]);

    expect(declared.length).toBeGreaterThan(0);
    for (const gate of declared) {
      expect(gateModes[gate], gate).toBeDefined();
    }
  });

  it("bildirilmiş bölümü yol parçalarından bulur", () => {
    expect(sectionAt("employer", ["ilanlar"])?.label).toBe("İlanlarım");
    expect(sectionAt("worker", ["mesajlar"])?.label).toBe("Mesajlar");
  });

  it("İşlerim bölümünü teslim edilmiş bağlantı olarak kaydeder", () => {
    expect(sectionAt("worker", ["islerim"])).toEqual({
      href: "/panel/islerim",
      label: "İşlerim",
      requires: [],
      status: "ready",
    });
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
