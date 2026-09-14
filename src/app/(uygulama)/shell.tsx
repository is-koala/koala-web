import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell, SectionNotOpen } from "@/components/app-shell";
import { GateBlocks } from "@/components/employer-gate";
import { UnreadMessagesBadge } from "@/components/messaging/unread-messages-badge";
import { Card } from "@/components/ui";
import { appShells, publicJobsPath, sectionAt, type AppShellId } from "@/lib/app-routes";
import { enterSection, enterShellGates } from "@/server/session/gates";
import { enterShell } from "@/server/session/viewer";

import mascotEmployer from "../../../public/brand/maskot-isveren.webp";
import mascotWorker from "../../../public/brand/maskot-calisan.webp";
import { EmployerDashboard } from "./isveren/dashboard";

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
 * `enterShellGates()` önce oturum kapısını açar, sonra bu isteğin profilini
 * okur ve kabuğun bildirdiği kapıları çözer; üçünün sırası önemli, bu yüzden
 * tek bir çağrının arkasında duruyor.
 *
 * Burada yalnız **kabuk düzeyindeki** kapılar çözülüyor, bölümünkiler değil:
 * Next bir layout'u kardeş rotalar arasında gezinirken yeniden çalıştırmıyor,
 * yani adrese bağlı bir karar burada bir gezinme sonra bayatlardı. Kabuğun
 * kapıları adresten bağımsız — kullanıcı hangi sayfada olursa olsun aynı
 * eksiği taşıyor.
 */
export async function ShellLayout({
  shell,
  children,
}: {
  shell: AppShellId;
  children: React.ReactNode;
}) {
  const { viewer, failure, advisories } = await enterShellGates(shell);

  return (
    <AppShell
      shell={appShells[shell]}
      context={{ viewer, failure }}
      advisories={advisories}
      headerActions={viewer ? (
        <UnreadMessagesBadge
          viewerId={viewer.id}
          href={`${appShells[shell].root}/mesajlar`}
        />
      ) : null}
    >
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
  const { viewer, blocked } = await enterShellGates(shell);

  return (
    <>
      <ShellWelcome shell={shell} name={viewer?.firstName ?? null} />

      {/*
       * Kabuğun engelleyici kapıları kökte yazılı duruyor: `isEmployer: false`
       * bir hesabın bireysel ilan açamayacağını ve bunun kayıt anında
       * kararlaştığını kullanıcı bir bölüme tıklamayı denemeden okumalı.
       */}
      <GateBlocks gates={blocked} />

      {/*
       * Kabuk kökü girişin de indiği yer (is-koala/koala-web#154). İşveren
       * özetini ve son başvurularını görür; iş arayan ilk işine yönlendirilir
       * — ilan bulmak, ve o liste kabuğun dışında (`/is-ilanlari`), menüden
       * ulaşılmıyor.
       */}
      {shell === "employer" && viewer !== null ? <EmployerDashboard viewer={viewer} /> : null}
      {shell === "worker" ? <ShellStart /> : null}
    </>
  );
}

/**
 * Karşılama şeridi.
 *
 * İşverende yeşil gradyan: tasarım sistemine göre üründe gradyanın olduğu
 * tek yer işveren panelinin karşılama bandı. Çalışan kabuğu düz beyaz kart.
 * Maskot dekor (`alt=""`); geniş ekranda bandın sağında, darda gizli.
 */
function ShellWelcome({ shell, name }: { shell: AppShellId; name: string | null }) {
  const definition = appShells[shell];
  const employer = shell === "employer";
  const mascot = employer ? mascotEmployer : mascotWorker;

  return (
    <section
      className={employer ? "shell-welcome" : "app-panel shell-welcome-plain"}
      aria-labelledby="shell-welcome-title"
    >
      <div className="shell-welcome-copy">
        <p className="eyebrow">{definition.title}</p>
        <h1 id="shell-welcome-title">{name ? `Merhaba ${name}` : "Merhaba"}</h1>
        <p className="lede">{definition.description}</p>
      </div>
      <div className="shell-welcome-mascot" aria-hidden="true">
        <Image src={mascot} alt="" height={150} width={100} sizes="100px" priority />
      </div>
    </section>
  );
}

/**
 * İş arayan kabuğunun giriş kartı.
 *
 * Bağlantılar kayıttaki adreslerden okunuyor ki bir bölüm taşınırsa kart da
 * onunla taşınsın.
 */
function ShellStart() {
  return (
    <Card as="section" className="shell-start" role="status">
      <h2>Buradan başla</h2>
      <p>
        Yakınındaki ilanları bul, başvur; başvurunun kabulünü, işi ve ödemeyi buradan takip et.
      </p>
      <ul className="shell-start-links">
        <li>
          <Link className="button button-primary button-small" href={publicJobsPath}>
            İlanlara göz at
          </Link>
        </li>
        <li>
          <Link className="button button-secondary button-small" href="/panel/basvurularim">
            Başvurularım
          </Link>
        </li>
        <li>
          <Link className="button button-secondary button-small" href="/panel/profil">
            Profilimi tamamla
          </Link>
        </li>
      </ul>
    </Card>
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

/**
 * Bir bölüm sayfasının kapısı.
 *
 * Bölümün `requires` listesini çözer ve engelleyici bir kapı varsa sayfanın
 * kendi içeriğini **hiç çizmez**. Sarmalayıcı olmasının nedeni bu: kapı bir
 * `if` ile sayfanın içinde okunsaydı, sayfanın veri çağrıları kapıdan önce
 * başlar ve kullanıcının göremeyeceği bir ekran için backend'e gidilirdi.
 *
 * Bölüm sayfaları bunu layout'tan miras almaz, kendileri sarar: Next
 * layout'ları kardeş rotalar arasında yeniden çalıştırmıyor, yani adrese
 * bağlı bir kapı layout'ta bir gezinme sonra bayatlar. Kabuğun kuralı da
 * zaten bu — sayfa kendi kapısını taşır (`AGENTS.md`).
 *
 * `href` kayıttaki adresle birebir aynı olmalı; `sectionAt` tanımadığı bir
 * adres için kapı bildirmez.
 */
export async function ShellGate({
  shell,
  href,
  children,
}: {
  shell: AppShellId;
  href: string;
  children: React.ReactNode;
}) {
  const { blocked } = await enterSection(shell, href);

  if (blocked.length > 0) return <GateBlocks gates={blocked} />;

  return <>{children}</>;
}
