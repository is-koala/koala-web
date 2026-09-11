import type { GateId } from "./gates";

/**
 * Oturumlu kabukların rota kaydı.
 *
 * Menü buradan çizilir ve `[...bolum]` yakalayıcısı da buradan cevap verir:
 * kayıtta olan ama henüz teslim edilmemiş bir bölüm "yakında" ekranı, kayıtta
 * olmayan bir adres gerçek bir 404 üretir. İkisi tek listeden okunmasaydı
 * menüdeki bir bağlantı ile o adresin ne yaptığı ayrı ayrı bakım isterdi.
 *
 * Adresler kalıcıdır (`AGENTS.md`, "Yapı"): yeni bölüm eklemek serbest, var
 * olanı yeniden adlandırmak değil.
 */

type SectionIdentity = {
  /** Kabuk kökünün altındaki kalıcı adres. */
  readonly href: string;
  readonly label: string;
  /**
   * Bu bölümün asıl eyleminin arkasındaki yetki kapıları.
   *
   * `status` gibi zorunlu ve `note` gibi bir karar dayatıyor: isteğe bağlı
   * olsaydı yeni bir bölüm kapısını sessizce atlar ve kullanıcı eksiğini
   * ancak backend reddettiğinde öğrenirdi. Kapısı olmayan bölüm boş liste
   * yazar — "bakılmadı" ile "gerekmiyor" ayrı şeyler.
   *
   * Kararı `@/server/session/gates` veriyor, metni `@/lib/errors`.
   */
  readonly requires: readonly GateId[];
};

/** Rotası teslim edilmiş, tıklanabilir bölüm. */
export type ReadySection = SectionIdentity & { readonly status: "ready" };

/**
 * Rotası henüz yazılmamış bölüm. `note` zorunlu: kullanıcı tıklayamadığı bir
 * menü maddesinin nedenini ekranda okumalı, ve bu tip onu yazmadan bölüm
 * eklenmesine izin vermiyor.
 */
export type PlannedSection = SectionIdentity & {
  readonly status: "planned";
  readonly note: string;
};

export type AppSection = ReadySection | PlannedSection;

export type AppShellId = "employer" | "worker";

/**
 * Herkese açık ilan listesi.
 *
 * Kabuk bölümü değil — oturum istemeyen, indekslenen bir tanıtım rotası — ama
 * adresi yine burada duruyor: menü (`site.ts`), site haritası, ilan kartının
 * bağlantısı ve sayfalama bağlantıları aynı yolu kuruyor ve dördü ayrı ayrı
 * yazılsaydı biri değiştiğinde öbürleri sessizce başka bir yere giderdi. Bu
 * dosya deponun tek rota kaydı; ikinci bir kayıt açmak o sorunu çözmezdi.
 *
 * Ad kalıcı: `AGENTS.md` § "Yapı" gereği yayına çıkmış bir rota yeniden
 * adlandırılmaz. "İş ilanları" aranan ifadenin kendisi; `/ilanlar` tek başına
 * belirsiz olurdu.
 */
export const publicJobsPath = "/is-ilanlari";

/**
 * Herkese açık ilan ayrıntısı.
 *
 * Kimlik tarayıcıdan geliyor; yola konmadan kaçırılır.
 */
export function publicJobPath(jobId: string): string {
  return `${publicJobsPath}/${encodeURIComponent(jobId)}`;
}

/** Bireysel ilan açma formu; kayıtta bir bölüm olarak da bildirilir. */
export const newIndividualJobPath = "/isveren/ilan/yeni";

/**
 * Açtığım ilanların listesi; kayıtta bir bölüm olarak da bildirilir.
 *
 * Sabit, çünkü listeyi hem menü hem de sıralama ve sayfa bağlantıları kuruyor:
 * adres iki yerde yazılsaydı biri değiştiğinde öbürü sessizce başka bir yere
 * giderdi.
 */
export const employerJobsPath = "/isveren/ilanlar";

/**
 * Şirket bölümünün girişi; kullanıcının yetkilisi olduğu şirketlere buradan
 * dallanılır. Kayıtta bir bölüm olarak da bildirilir.
 */
export const companySectionPath = "/isveren/sirket";

/**
 * Şirket oluşturma formu.
 *
 * Menüde ayrı bir madde değil ve kayıtta da bir bölüm değil: kullanıcının
 * hep görmesi gereken kalıcı bir yer değil, "Şirketim" bölümünün içinden
 * çıkan tek seferlik bir eylem. Kimlik kapısını da bu yüzden bölüm kaydından
 * değil `companyCreation` kararından okuyor.
 */
export const newCompanyPath = `${companySectionPath}/yeni`;

/**
 * Bireysel fatura adresi. Menüde yok: kapı şeridinden ve hesap ayarlarından
 * açılıyor, şirket formu gibi tek seferlik bir eylem değil ama kalıcı bir
 * bölüm de değil — `[...section]` onu tanısaydı gerçek sayfanın önüne
 * "henüz açılmadı" koyardı.
 */
export const employerBillingAddressPath = "/isveren/adres";

/**
 * İş arayanın başvuru adresi. Menüde yok: `APPLICANT_ADDRESS_REQUIRED`
 * çözümü buraya düşer. `[...section]` onu tanısaydı gerçek sayfanın önüne
 * "henüz açılmadı" koyardı.
 */
export const workerApplicantAddressPath = "/panel/adres";

/**
 * Bir şirketin profili.
 *
 * Seçili şirket **rotada** taşınıyor, yerel durumda değil: bir kullanıcı
 * birden çok şirketin yetkilisi olabiliyor ve iki sekmede iki şirket açıkken
 * paylaşılan bir bağlantı doğru şirketi açmalı.
 */
export function companyProfilePath(companyId: string): string {
  return `${companySectionPath}/${encodeURIComponent(companyId)}`;
}

/** Şirketin düzenleme ekranı; yalnız `ADMIN` yetkilisi kaydedebiliyor. */
export function editCompanyPath(companyId: string): string {
  return `${companyProfilePath(companyId)}/duzenle`;
}

/**
 * Şirket adına ilan açma formu.
 *
 * Şirket **adreste**, tıpkı `POST /companies/{companyId}/jobs` gibi: ilan hangi
 * şirket adına açılıyorsa kapı da o şirket için okunuyor ve iki sekmede iki
 * şirketle çalışan kullanıcı yanlış şirkete ilan açamıyor.
 *
 * Bireysel formun (`/isveren/ilan/yeni`) ayrı bir adres olarak kalmasının
 * nedeni kapı: o bölüm `employerRole` istiyor ve rol kayıt anında yazılıyor.
 * Şirket ilanının böyle bir koşulu yok — `JobManager.createCorporateJob`
 * yalnız yetkililiğe bakıyor — yani iki formu tek adrese koymak, davetle
 * katılmış ama işveren olmayan bir yetkiliyi yapabildiği bir işten alıkoyardı.
 *
 * Kayıtta bir bölüm değil: menüde kalıcı bir yer değil, "Şirketim" ve
 * "İlanlarım" içinden çıkan tek seferlik bir eylem.
 */
export function newCompanyJobPath(companyId: string): string {
  return `${companyProfilePath(companyId)}/ilan/yeni`;
}

/**
 * Yayımlanmış bir ilanın sayfası.
 *
 * Menüde yok, çünkü bir liste maddesi değil bir kaydın adresi; kapıları da
 * yok — ilanı zaten açmış kullanıcı onu görebilmeli. Kapatma ve iptal
 * eylemleri de burada duruyor ve kendi kapılarını taşımıyor: yetkiyi
 * `JobManager.requireJobEditor` ilanın kaydından okuyor, yetkisiz kullanıcı
 * ilanı zaten göremiyor.
 */
export function publishedJobPath(jobId: string): string {
  return `/isveren/ilan/${encodeURIComponent(jobId)}`;
}

/**
 * Bir ilana gelen başvuruların listesi.
 *
 * Adres ilanın **altında**, kabuk menüsünde değil: bir başvuru tek başına bir
 * kayıt değil, bir ilanın kaydı, ve `GET /jobs/{jobId}/applications` dışında
 * onu getiren bir uç yok. Kapısı da yok — ilanı görebilen kullanıcı
 * başvurularını da görebilmeli; yetkiyi backend ilanın kaydından okuyor.
 */
export function jobApplicantsPath(jobId: string): string {
  return `${publishedJobPath(jobId)}/basvurular`;
}

/**
 * Yetenek havuzu bölümü.
 *
 * Başvuru ekranından beslenen kalıcı bir liste, o yüzden menüde kendi maddesi
 * var: kullanıcı bir ilanı kapattıktan sonra da beğendiği adayları bulabilmeli.
 */
export const talentPoolPath = "/isveren/yetenek-havuzu";

export type AppShell = {
  readonly id: AppShellId;
  /** Kabuğun kökü; `private-routes.ts` içindeki ağaç girdisiyle aynı olmalı. */
  readonly root: string;
  readonly title: string;
  /** Kabuğun ne olduğunu bir cümlede söyleyen giriş metni. */
  readonly description: string;
  /**
   * Kabuğun tamamında geçerli kapılar.
   *
   * Bölümün değil kabuğun listesi, çünkü kimlik gibi bir eksik tek bir
   * bölümün işi değil: kullanıcı hangi sayfada olursa olsun aynı eksiği
   * taşıyor ve şeridi her sayfada görmeli.
   */
  readonly requires: readonly GateId[];
  readonly sections: readonly AppSection[];
};

/**
 * İşveren kabuğu.
 *
 * Menüdeki her madde bir dalga 5-7 issue'suna karşılık geliyor; hazır olanlar
 * aynı kayıtta bağlantıya dönüşüyor.
 */
const employerShell: AppShell = {
  id: "employer",
  root: "/isveren",
  title: "İşveren",
  description: "İlanlarını, başvuruları ve atamalarını buradan yönetirsin.",
  // Kimlik kapısı işveren kabuğunun üç eyleminin de önünde
  // (`JobManager.java:110`, `CompanyManager.java:103`); işveren rolü ise
  // yalnız bireysel ilanın önünde, ama kayıt anında yazıldığı ve geri
  // alınamadığı için kullanıcı bunu kabuğa girer girmez bilmeli.
  requires: ["identityVerification", "employerRole"],
  sections: [
    {
      href: companySectionPath,
      label: "Şirketim",
      // `CompanyManager.java:103-105` şirket kurmak için kimlik istiyor.
      // Kip `advisory`: kimliği doğrulanmamış ama şirketi olan bir kullanıcı
      // (davetle katılmış olabilir) profilini görebilmeli. Kapı yalnız
      // **oluşturma** eyleminin önünde kapanıyor ve o karar
      // `viewerGates(...).companyCreation` içinde.
      requires: ["identityVerification"],
      status: "ready",
    },
    {
      href: employerJobsPath,
      label: "İlanlarım",
      // İlan açmanın ortak koşulu. Bireysel/şirket ayrımı ve şirket onayı
      // ilanın açılacağı yere göre eylem başında kararlaşıyor. Kip `advisory`:
      // liste yalnız okuyor ve kimliği doğrulanmamış kullanıcı da açtığı
      // ilanları görebilmeli.
      requires: ["identityVerification"],
      status: "ready",
    },
    {
      href: newIndividualJobPath,
      label: "Yeni ilan",
      // `JobManager.java:105-114` gövdeye hiç bakmadan iki koşul arıyor. Rol
      // engelleyici kip: kayıt anında yazılıp geri alınamadığı için form hiç
      // çizilmez. Kimlik kapısı kabuk düzeyinde şerit olarak duruyor ve
      // yayımlama düğmesini eylemin kendi kapısı kapatıyor — form doldurulup
      // doğrulama beklenebilsin diye.
      requires: ["employerRole"],
      status: "ready",
    },
    {
      href: "/isveren/basvurular",
      label: "Başvurular",
      // Başvuruları görmek kapıya takılmıyor; kabul kararı atama ve ödeme
      // kapılarını açıyor ve onlar eylem başında okunuyor.
      requires: [],
      status: "planned",
      // Başvurular ilanın kendi sayfasından açılıyor (`jobApplicantsPath`).
      // İlanlar arası bir gelen kutusu creator bazlı ilan listesini bekliyor
      // (is-koala/koala-web#33): o uç olmadan hangi ilanların başvurusu
      // toplanacağı okunamıyor.
      note: "Başvurular şimdilik her ilanın kendi sayfasından açılıyor; ilanlar arası gelen kutusu ilan listesiyle birlikte gelecek.",
    },
    {
      href: talentPoolPath,
      label: "Yetenek havuzu",
      // `EmployerToolsController.java:58-95` havuz uçlarında kimlik ya da rol
      // aramıyor; liste yalnız oturum istiyor.
      requires: [],
      status: "ready",
    },
    {
      href: "/isveren/atamalar",
      label: "Atamalar",
      requires: [],
      status: "ready",
    },
    {
      href: "/isveren/mesajlar",
      label: "Mesajlar",
      requires: [],
      status: "ready",
    },
    {
      href: "/isveren/odemeler",
      label: "Ödemeler",
      // Bu bölüm yalnız finansal durumu okur. Kimlik, kimlik numarası ve
      // fatura adresi ödeme **başlatma** eyleminin kapılarıdır; geçmişi
      // görmek için kullanıcıyı bölümün dışında bırakmaz.
      requires: [],
      status: "ready",
    },
    {
      href: "/isveren/hesap",
      label: "Hesap ve ayarlar",
      requires: [],
      status: "ready",
    },
  ],
};

/** İş arayan kabuğu. Aynı iskelet, kendi menüsü. */
const workerShell: AppShell = {
  id: "worker",
  root: "/panel",
  title: "Panel",
  description: "Başvurularını, işlerini ve kazançlarını buradan takip edersin.",
  // Boş, ve bilerek: başvuru kimliği hâlâ uygulamada (#18). Adres eksiği
  // kabuk şeridi değil; `APPLICANT_ADDRESS_REQUIRED` başvuru formundan
  // `/panel/adres`'e düşer (is-koala/koala-web#133).
  requires: [],
  sections: [
    {
      href: "/panel/profil",
      label: "Profilim",
      requires: [],
      status: "ready",
    },
    {
      href: "/panel/islerim",
      label: "İşlerim",
      requires: [],
      status: "ready",
    },
    {
      href: "/panel/basvurularim",
      label: "Başvurularım",
      requires: [],
      status: "ready",
    },
    {
      href: "/panel/mesajlar",
      label: "Mesajlar",
      requires: [],
      status: "ready",
    },
    {
      href: "/panel/kazanclarim",
      label: "Kazançlarım",
      requires: [],
      status: "ready",
    },
    {
      href: "/panel/hesap",
      label: "Hesap ve ayarlar",
      requires: [],
      status: "ready",
    },
  ],
};

export const appShells: Record<AppShellId, AppShell> = {
  employer: employerShell,
  worker: workerShell,
};

/**
 * Kabuk kökünün altındaki yol parçalarının bildirilmiş bir bölüme denk gelip
 * gelmediği.
 *
 * Parça listesi alır, tam adres değil: kökü çağıran tarafta yazmak, adresin
 * ikinci bir kaynağını doğururdu. Kök buradan, kaydın kendisinden gelir.
 */
export function sectionAt(
  shell: AppShellId,
  segments: readonly string[],
): AppSection | undefined {
  const href = [appShells[shell].root, ...segments].join("/");
  return appShells[shell].sections.find((section) => section.href === href);
}
