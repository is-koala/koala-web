import { describe, expect, it } from "vitest";

import {
  appShells,
  companyProfilePath,
  companySectionPath,
  editCompanyPath,
  employerJobsPath,
  companyGalleryPath,
  jobApplicantsPath,
  jobGalleryPath,
  applicantDossierPath,
  newCompanyJobPath,
  newCompanyPath,
  newIndividualJobPath,
  publishedJobPath,
  sectionAt,
  talentPoolPath,
  employerBillingAddressPath,
  workerApplicantAddressPath,
  workerNotificationsPath,
  shellHomePath,
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
      "Yetenek havuzu",
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
    //
    // Kapsama denetimi, eşitlik değil: kapalı ağaçlar kabuk köklerinden
    // ibaret değil. `/davet` bir kabuk değil ama aynı üç başlığı taşımak
    // zorunda, çünkü adresi bir davet kimliği taşıyor ve o kimliği bilen
    // herkes daveti okuyabiliyor. Eşitlik dayatmak, kabuk olmayan her kapalı
    // adresi ya kayda uydurma bir bölüm olarak sokturur ya da başlıksız
    // bırakırdı.
    for (const shell of Object.values(appShells)) {
      expect(privateRouteTrees, shell.id).toContain(shell.root);
    }
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

  it("İlanlarım bölümünü teslim edilmiş bağlantı olarak kaydeder", () => {
    // `planned` kalsaydı menü maddesi tıklanamaz olur ve `[...section]`
    // yakalayıcısı gerçek listenin önüne "henüz açılmadı" ekranını koyardı.
    expect(sectionAt("employer", ["ilanlar"])).toEqual({
      href: employerJobsPath,
      label: "İlanlarım",
      // Kimlik kapısı `advisory`: liste yalnız okuyor ve kimliği
      // doğrulanmamış kullanıcı da açtığı ilanları görebilmeli.
      requires: ["identityVerification"],
      status: "ready",
    });
  });

  it("şirket ilanı formunu şirketin kendi adresi altında kurar", () => {
    // Şirket adreste, tıpkı `POST /companies/{companyId}/jobs` gibi: kapı o
    // şirket için okunuyor.
    expect(newCompanyJobPath("4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99")).toBe(
      "/isveren/sirket/4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99/ilan/yeni",
    );
    expect(newCompanyJobPath("a b/../hesap")).toBe("/isveren/sirket/a%20b%2F..%2Fhesap/ilan/yeni");
  });

  it("şirket ilanı formunu bölüm saymaz", () => {
    expect(
      sectionAt("employer", ["sirket", "4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99", "ilan", "yeni"]),
    ).toBeUndefined();
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

  it("başvuru listesini ilanın altında, kimliği kaçırarak adresler", () => {
    // Başvuru bir ilanın kaydı: `GET /jobs/{jobId}/applications` dışında onu
    // getiren bir uç yok, bu yüzden adres de ilanın altında duruyor.
    expect(jobApplicantsPath("4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99")).toBe(
      "/isveren/ilan/4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99/basvurular",
    );
    expect(jobApplicantsPath("a b/../hesap")).toBe("/isveren/ilan/a%20b%2F..%2Fhesap/basvurular");
  });

  it("başvuru listesini kayıtta bir bölüm saymaz", () => {
    // `[...section]` onu tanısaydı gerçek sayfa yerine "henüz açılmadı"
    // ekranı çizilirdi.
    expect(sectionAt("employer", ["ilan", "x", "basvurular"])).toBeUndefined();
  });

  it("ilan galerisini ilanın altında, kimliği kaçırarak adresler", () => {
    expect(jobGalleryPath("4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99")).toBe(
      "/isveren/ilan/4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99/galeri",
    );
    expect(jobGalleryPath("a b/../hesap")).toBe("/isveren/ilan/a%20b%2F..%2Fhesap/galeri");
  });

  it("aday dosyasını kabuk altında, kimliği kaçırarak adresler ve bölüm saymaz", () => {
    expect(applicantDossierPath("6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f")).toBe(
      "/isveren/aday/6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f",
    );
    expect(applicantDossierPath("a b/../hesap")).toBe("/isveren/aday/a%20b%2F..%2Fhesap");
    expect(sectionAt("employer", ["aday", "x"])).toBeUndefined();
  });

  it("şirket galerisini şirket kimliğiyle kurar", () => {
    // Sabit `/isveren/sirket/galeri` iki şirketi tek adreste toplardı.
    expect(companyGalleryPath("4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99")).toBe(
      "/isveren/sirket/4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99/galeri",
    );
    expect(companyGalleryPath("a b/../hesap")).toBe("/isveren/sirket/a%20b%2F..%2Fhesap/galeri");
  });

  it("galeri adreslerini kayıtta bir bölüm saymaz", () => {
    expect(sectionAt("employer", ["ilan", "x", "galeri"])).toBeUndefined();
    expect(sectionAt("employer", ["sirket", "galeri"])).toBeUndefined();
  });

  it("yetenek havuzunu teslim edilmiş işveren bölümü olarak kaydeder", () => {
    expect(sectionAt("employer", ["yetenek-havuzu"])).toEqual({
      href: talentPoolPath,
      label: "Yetenek havuzu",
      requires: [],
      status: "ready",
    });
    expect(talentPoolPath).toBe("/isveren/yetenek-havuzu");
  });

  it("ilanlar arası başvuru gelen kutusunu planlı ve gerekçeli bırakır", () => {
    // Bölüm creator bazlı ilan listesini bekliyor (is-koala/koala-web#33);
    // bugün başvurular yalnız ilanın kendi sayfasından açılıyor.
    const inbox = sectionAt("employer", ["basvurular"]);

    expect(inbox?.status).toBe("planned");
    expect(inbox?.status === "planned" && inbox.note).toContain("ilan");
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

  it("Bildirimler bölümünü teslim edilmiş çalışan bağlantısı olarak kaydeder", () => {
    expect(workerNotificationsPath).toBe("/panel/bildirimler");
    expect(sectionAt("worker", ["bildirimler"])).toEqual({
      href: "/panel/bildirimler",
      label: "Bildirimler",
      requires: [],
      status: "ready",
    });
  });

  it("iş arayan kabuğunun her bölümü teslim edilmiş; yakalayıcı yalnız 404 üretir", () => {
    // is-koala/koala-web#154: kabukta "henüz açılmadı" ekranı kalmadı. Yeni
    // bir bölüm `planned` olarak eklenirse bu test onu görünür kılar.
    expect(appShells.worker.sections.every((section) => section.status === "ready")).toBe(true);
  });

  it("giriş sonrası hedefi kabuk kökünden okur", () => {
    expect(shellHomePath("worker")).toBe("/panel");
    expect(shellHomePath("employer")).toBe("/isveren");
  });

  it("bildirilmemiş yolu tanımaz", () => {
    // Kayıtta olmayan yol gerçek bir 404'tür; "henüz açılmadı" demek yazım
    // hatasını var olmayan bir bölüm gibi gösterirdi.
    expect(sectionAt("employer", ["bilinmeyen"])).toBeUndefined();
    expect(sectionAt("employer", ["ilanlar", "yeni"])).toBeUndefined();
    // Form `/isveren/ilan/yeni`; `/isveren/ilan` tek başına bir bölüm değil.
    expect(sectionAt("employer", ["ilan"])).toBeUndefined();
  });

  it("fatura adresi ekranını bölüm saymadan adresler", () => {
    // Menüde kalıcı bir madde değil: kapı şeridinden ve hesap ayarlarından
    // açılıyor. `[...section]` onu tanısaydı gerçek sayfanın önüne "henüz
    // açılmadı" ekranı koyardı.
    expect(employerBillingAddressPath).toBe("/isveren/adres");
    expect(sectionAt("employer", ["adres"])).toBeUndefined();
  });

  it("iş arayan adres ekranını bölüm saymadan adresler", () => {
    // Başvuru kapısı buraya düşer; menüde kalıcı madde değil. `[...section]`
    // onu tanısaydı gerçek sayfanın önüne "henüz açılmadı" koyardı.
    expect(workerApplicantAddressPath).toBe("/panel/adres");
    expect(sectionAt("worker", ["adres"])).toBeUndefined();
  });

  it("bir kabuğun bölümünü öbür kabukta tanımaz", () => {
    // İki kabuk birbirinin adreslerini kabul etseydi `/isveren/kazanclarim`
    // sessizce çalışır ve menüde olmayan bir sayfa doğardı.
    expect(sectionAt("worker", ["kazanclarim"])?.label).toBe("Kazançlarım");
    expect(sectionAt("employer", ["kazanclarim"])).toBeUndefined();
  });
});
