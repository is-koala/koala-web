import { notFound } from "next/navigation";

import { AppShell, SectionNotOpen, ShellNotice } from "@/components/app-shell";
import { appShells, sectionAt, type AppShellId } from "@/lib/app-routes";
import { enterShell } from "@/server/session/viewer";

/**
 * İki kabuğun ortak rota gövdeleri.
 *
 * `/isveren` ile `/panel` aynı iskeleti, aynı kapıyı ve aynı "henüz açılmadı"
 * davranışını paylaşıyor; ayrıldıkları tek yer hangi kabuk oldukları. Gövdeler
 * burada bir kez durunca rota dosyaları üç satıra iniyor ve bir davranış iki
 * kabukta ayrışamıyor.
 */

/**
 * Kabuk layout'unun gövdesi.
 *
 * `enterShell()` önce oturum kapısını açar, sonra bu isteğin profilini okur;
 * ikisinin sırası önemli, bu yüzden tek bir çağrının arkasında duruyor.
 */
export async function ShellLayout({
  shell,
  children,
}: {
  shell: AppShellId;
  children: React.ReactNode;
}) {
  const context = await enterShell();

  return (
    <AppShell shell={appShells[shell]} context={context}>
      {children}
    </AppShell>
  );
}

/**
 * Kabuğun giriş sayfası.
 *
 * `enterShell()` burada da çağrılıyor — layout onu zaten çağırdı, ama kapı
 * ucuz (çerez okuması) ve profil `React.cache()` ile paylaşılıyor, yani
 * backend'e ikinci bir tur çıkmıyor. Kabuğun altındaki her sayfanın kalıbı
 * budur: sayfa kendi kapısını taşır ve kullanıcıyı layout'un çağrısından
 * miras almaz.
 */
export async function ShellHome({ shell }: { shell: AppShellId }) {
  const { viewer } = await enterShell();
  const definition = appShells[shell];

  return (
    <section className="app-panel">
      <p className="eyebrow">{definition.title}</p>
      <h1>{viewer ? `Merhaba ${viewer.firstName}` : "Merhaba"}</h1>
      <p className="lede">{definition.description}</p>

      {/* Kabuk kökü, menüdeki hazır ve planlı bölümlere ortak yön verir. */}
      <ShellNotice
        title="Bölümler sırayla açılıyor"
        message="Hazır bölümlere menüden ulaşabilirsin. Diğer maddeler açıldığında tıklanabilir olacak."
      />
    </section>
  );
}

/**
 * Kabuğun altındaki, henüz kendi dosyası olmayan adresler.
 *
 * Yakalayıcı her yolu kabul etmiyor: cevabı rota kaydından okuyor. Kayıtta
 * bildirilmiş bir bölüm "henüz açılmadı" ekranı görür, kayıtta olmayan adres
 * gerçek bir 404 alır — aksi hâlde bir yazım hatası, var olmayan bir bölüm
 * gibi görünürdü.
 *
 * **Kabuk kökünde `loading.tsx` olmamasının nedeni burası.** Segment bir
 * Suspense sınırıyla sarıldığında kabuk render'ın başında akıtılır ve HTTP
 * durumu 200'de kilitlenir; `notFound()` sayfayı çizer ama durum kodu artık
 * değiştirilemez, yani var olmayan bir adres 200 döner. Yükleniyor durumu
 * bölümün kendi `page.tsx` dosyasının yanına konmalı — orada kabuk da ekranda
 * kalır, yalnız içerik alanı bekler.
 *
 * Bölümün kendi `page.tsx` dosyası indiğinde Next statik segmenti bu
 * yakalayıcıdan önce eşleştirir; burada yapılacak bir şey kalmaz.
 */
export async function ShellSection({
  shell,
  params,
}: {
  shell: AppShellId;
  params: Promise<{ section: string[] }>;
}) {
  await enterShell();
  const { section } = await params;
  const declared = sectionAt(shell, section);

  if (declared === undefined || declared.status === "ready") notFound();

  return <SectionNotOpen section={declared} />;
}
