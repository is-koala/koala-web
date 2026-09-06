import { describe, expect, it } from "vitest";

import {
  appShells,
  companyProfilePath,
  companySectionPath,
  editCompanyPath,
  newCompanyPath,
  newIndividualJobPath,
  publishedJobPath,
  sectionAt,
} from "./app-routes";
import { gateModes } from "./gates";
import { privateRouteTrees } from "./private-routes";

describe("kabuk rota kaydı", () => {
  it("işveren menüsünü issue'daki sırayla taşır", () => {
    expect(appShells.employer.sections.map((section) => section.label)).toEqual([
      "Şirketim",
      "İlanlarım",
      "Yeni ilan",
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
      requires: [],
      status: "ready",
    });
    expect(sectionAt("employer", ["hesap"])).toEqual({
      href: "/isveren/hesap",
      label: "Hesap ve ayarlar",
      requires: [],
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

  it("başvurularım bölümünü hazır iş arayan rotası olarak bildirir", () => {
    expect(sectionAt("worker", ["basvurularim"])).toEqual({
      href: "/panel/basvurularim",
      label: "Başvurularım",
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

  it("bireysel ilan formunu işveren rolü kapısının arkasına yazar", () => {
    // Rol kayıt anında yazılıyor ve geri alınamıyor (`AuthManager.java:157`);
    // kimlik ise doğrulanabilir bir eksik, bu yüzden formun kendi kapısı
    // değil kabuğun şeridi ve yayımlama düğmesi onu taşır.
    expect(sectionAt("employer", ["ilan", "yeni"])).toEqual({
      href: newIndividualJobPath,
      label: "Yeni ilan",
      requires: ["employerRole"],
      status: "ready",
    });
  });

  it("Şirketim bölümünü teslim edilmiş bağlantı olarak kaydeder", () => {
    // Bölüm `planned` kalsaydı menü maddesi tıklanamaz olur ve `[...section]`
    // yakalayıcısı gerçek sayfanın önüne "henüz açılmadı" ekranını koyardı.
    expect(sectionAt("employer", ["sirket"])).toEqual({
      href: companySectionPath,
      label: "Şirketim",
      requires: ["identityVerification"],
      status: "ready",
    });
  });

  it("şirket adreslerini tek yerden, kimliği kaçırarak kurar", () => {
    // Adresler hem sayfalarda hem Server Action'ların `revalidatePath`
    // çağrılarında kullanılıyor; iki yerde kurulsalardı yanlış yolu tazeleyen
    // bir eylem ekranda hiçbir iz bırakmazdı.
    expect(newCompanyPath).toBe("/isveren/sirket/yeni");
    expect(companyProfilePath("4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99")).toBe(
      "/isveren/sirket/4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99",
    );
    expect(editCompanyPath("4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99")).toBe(
      "/isveren/sirket/4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99/duzenle",
    );
    expect(companyProfilePath("a b/../hesap")).toBe("/isveren/sirket/a%20b%2F..%2Fhesap");
  });

  it("şirket alt adreslerini bölüm saymaz", () => {
    // `yeni` ve bir şirket kimliği kayıtta bir bölüm değil: `[...section]`
    // onları tanısaydı gerçek sayfalar inmeden önce "henüz açılmadı" ekranı
    // çizilirdi ve indikten sonra kayıt sessizce bayatlardı.
    expect(sectionAt("employer", ["sirket", "yeni"])).toBeUndefined();
    expect(sectionAt("employer", ["sirket", "4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99"])).toBeUndefined();
  });

  it("yayımlanan ilanın adresini kimliğinden kurar", () => {
    expect(publishedJobPath("4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99")).toBe(
      "/isveren/ilan/4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99",
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

  it("ödemeler bölümünü okuma için açık, ödeme eylemini kendi kapısına bırakarak bildirir", () => {
    // Kimlik ve adres ödeme oturumu açmanın koşuludur; geçmişi okumak için
    // kullanıcıyı bütün bölümün dışında bırakmak finansal görünürlüğü keserdi.
    expect(sectionAt("employer", ["odemeler"])).toEqual({
      href: "/isveren/odemeler",
      label: "Ödemeler",
      requires: [],
      status: "ready",
    });
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

  it("Kazançlarım bölümünü teslim edilmiş çalışan bağlantısı olarak kaydeder", () => {
    expect(sectionAt("worker", ["kazanclarim"])).toEqual({
      href: "/panel/kazanclarim",
      label: "Kazançlarım",
      requires: [],
      status: "ready",
    });
  });

  it("bildirilmemiş yolu tanımaz", () => {
    // Kayıtta olmayan yol gerçek bir 404'tür; "henüz açılmadı" demek yazım
    // hatasını var olmayan bir bölüm gibi gösterirdi.
    expect(sectionAt("employer", ["bilinmeyen"])).toBeUndefined();
    expect(sectionAt("employer", ["ilanlar", "yeni"])).toBeUndefined();
    // Form `/isveren/ilan/yeni`; `/isveren/ilan` tek başına bir bölüm değil.
    expect(sectionAt("employer", ["ilan"])).toBeUndefined();
  });

  it("bir kabuğun bölümünü öbür kabukta tanımaz", () => {
    // İki kabuk birbirinin adreslerini kabul etseydi `/isveren/kazanclarim`
    // sessizce çalışır ve menüde olmayan bir sayfa doğardı.
    expect(sectionAt("worker", ["kazanclarim"])?.label).toBe("Kazançlarım");
    expect(sectionAt("employer", ["kazanclarim"])).toBeUndefined();
  });
});
