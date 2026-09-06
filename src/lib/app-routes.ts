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

export type AppShell = {
  readonly id: AppShellId;
  /** Kabuğun kökü; `private-routes.ts` içindeki ağaç girdisiyle aynı olmalı. */
  readonly root: string;
  readonly title: string;
  /** Kabuğun ne olduğunu bir cümlede söyleyen giriş metni. */
  readonly description: string;
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
  sections: [
    {
      href: "/isveren/sirket",
      label: "Şirketim",
      status: "planned",
      note: "Şirket oluşturma ve profil yönetimi henüz açılmadı.",
    },
    {
      href: "/isveren/ilanlar",
      label: "İlanlarım",
      status: "planned",
      note: "İlan açma ve yönetim ekranları henüz açılmadı.",
    },
    {
      href: "/isveren/basvurular",
      label: "Başvurular",
      status: "planned",
      note: "Başvuru listesi ve aday inceleme henüz açılmadı.",
    },
    {
      href: "/isveren/atamalar",
      label: "Atamalar",
      status: "planned",
      note: "Atama takibi henüz açılmadı.",
    },
    {
      href: "/isveren/mesajlar",
      label: "Mesajlar",
      status: "planned",
      note: "Web mesajlaşması henüz açılmadı.",
    },
    {
      href: "/isveren/odemeler",
      label: "Ödemeler",
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
  sections: [
    {
      href: "/panel/islerim",
      label: "İşlerim",
      status: "planned",
      note: "Kabul edilen işlerin takibi henüz açılmadı.",
    },
    {
      href: "/panel/basvurularim",
      label: "Başvurularım",
      status: "planned",
      note: "Başvuru akışı ve listesi henüz açılmadı.",
    },
    {
      href: "/panel/mesajlar",
      label: "Mesajlar",
      status: "planned",
      note: "Web mesajlaşması henüz açılmadı.",
    },
    {
      href: "/panel/kazanclarim",
      label: "Kazançlarım",
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
