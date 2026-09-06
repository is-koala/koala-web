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

/** Bireysel ilan açma formu; kayıtta bir bölüm olarak da bildirilir. */
export const newIndividualJobPath = "/isveren/ilan/yeni";

/**
 * Yayımlanmış bir ilanın sayfası.
 *
 * Menüde yok, çünkü bir liste maddesi değil bir kaydın adresi; kapıları da
 * yok — ilanı zaten açmış kullanıcı onu görebilmeli. Kapatma ve iptal
 * eylemleri buraya is-koala/koala-web#34 ile geliyor.
 */
export function publishedJobPath(jobId: string): string {
  return `/isveren/ilan/${encodeURIComponent(jobId)}`;
}

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
 * Menüdeki her madde bir dalga 5-7 issue'suna karşılık geliyor ve hiçbiri
 * bugün teslim edilmedi; kabuk onların ortak iskeleti olarak önce iniyor.
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
      href: "/isveren/sirket",
      label: "Şirketim",
      // `CompanyManager.java:103-105` şirket kurmak için kimlik istiyor.
      requires: ["identityVerification"],
      status: "planned",
      note: "Şirket oluşturma ve profil yönetimi henüz açılmadı.",
    },
    {
      href: "/isveren/ilanlar",
      label: "İlanlarım",
      // İlan açmanın ortak koşulu. Bireysel/şirket ayrımı ve şirket onayı
      // ilanın açılacağı yere göre eylem başında kararlaşıyor.
      requires: ["identityVerification"],
      status: "planned",
      note: "İlan açma ve yönetim ekranları henüz açılmadı.",
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
      note: "Başvuru listesi ve aday inceleme henüz açılmadı.",
    },
    {
      href: "/isveren/atamalar",
      label: "Atamalar",
      requires: [],
      status: "planned",
      note: "Atama takibi henüz açılmadı.",
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
      // `JobAssignmentManager.java:212` iki koşul arıyor: doğrulanmış kimlik
      // **ve** dolu TC. Yalnız ilkini bildirmek kullanıcıyı ödeme ekranında
      // beklenmedik bir 400'e sokardı.
      requires: ["identityVerification", "identityNumber"],
      status: "planned",
      note: "Ödeme ve emanet özeti henüz açılmadı.",
    },
  ],
};

/** İş arayan kabuğu. Aynı iskelet, kendi menüsü. */
const workerShell: AppShell = {
  id: "worker",
  root: "/panel",
  title: "Panel",
  description: "Başvurularını, işlerini ve kazançlarını buradan takip edersin.",
  // Boş, ve bilerek: başvuru yapmanın da kimlik kapısı var
  // (`JobApplicationManager.java:245-249`, ayrıca `APPLICANT_ADDRESS_REQUIRED`
  // ile adres koşulu), ama iş arayan tarafını başvuru dilimi teslim ediyor
  // (is-koala/koala-web#36). Kapı katmanı hazır; orada tek satır yetecek.
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
      status: "planned",
      note: "Başvuru akışı ve listesi henüz açılmadı.",
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
      status: "planned",
      note: "Kazanç listesi henüz açılmadı.",
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
