import Link from "next/link";

import { Wordmark } from "@/brand/Wordmark";
import { GateAdvisories } from "@/components/employer-gate";
import { ErrorState } from "@/components/states";
import type { AppSection, AppShell as AppShellDefinition } from "@/lib/app-routes";
import type { GateId } from "@/lib/gates";
import type { ViewerContext } from "@/server/session/viewer";

export type AppShellProps = {
  shell: AppShellDefinition;
  /** Kapıdan geçmiş isteğin kullanıcı bağlamı; profil çözülemediyse `viewer` boş. */
  context: ViewerContext;
  /**
   * Kabuğun bildirdiği ama karşılanmamış advisory kapılar.
   *
   * Zorunlu ve boş liste yazılabilir: isteğe bağlı olsaydı yeni bir kabuk
   * şeridi sessizce düşürürdü ve kimse fark etmezdi.
   */
  advisories: readonly GateId[];
  children: React.ReactNode;
  headerActions?: React.ReactNode;
};

/**
 * İki oturumlu kabuğun ortak iskeleti: üst bar, menü ve sayfa alanı.
 *
 * Sunum bileşeni ve senkron — oturumu, çerezi, rolü kendisi okumaz; ne
 * verilirse onu çizer. Kapıyı ve profili layout açar, böylece bu dosya bir
 * React render'ı kurmadan test edilebilir kalır.
 *
 * **Rol değiştirici yok.** "Web'de rol değiştirilebilir mi?" sorusunun
 * cevabını yalnız ürün sahibi verebilir (is-koala/koala-web#25). Karar
 * gelmeden konacak bir geçiş bağlantısı, geri alınması pahalı bir ürün
 * kararını sessizce vermek olurdu; iki kabuk da bugün yalnız adresinden
 * açılıyor.
 */
export function AppShell({ shell, context, advisories, children, headerActions }: AppShellProps) {
  const { viewer, failure } = context;

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="app-bar-inner">
          <Wordmark />
          <span className="app-bar-title">{shell.title}</span>
          <div className="app-bar-actions">
            {viewer === null ? null : headerActions}
            {viewer === null ? null : <span className="app-bar-user">{viewer.displayName}</span>}
            <Link className="nav-auth-link" href="/cikis">
              Çıkış
            </Link>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/*
         * Menü yalnız profil çözüldüğünde çizilir. Bir arıza sırasında
         * bağlantıları göstermek, arkasında ne olduğu denetlenmemiş kapıları
         * işaret etmek demek; nedeni aşağıdaki hata durumu yazıyor.
         *
         * `details` dar ekranda menüyü kapatılabilir yapıyor ve bunu JavaScript
         * olmadan yapıyor: kapatma tercihi ziyaretçinin, ve JavaScript hiç
         * çalışmasa da menü açık kalıyor.
         */}
        {viewer === null ? null : (
          <details className="app-nav-disclosure" open>
            <summary>Menü</summary>
            <nav className="app-nav" aria-label={`${shell.title} menüsü`}>
              <ul>
                {shell.sections.map((section) => (
                  <li key={section.href}>
                    <SectionEntry section={section} />
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        )}

        <main className="app-main">
          {failure === null ? null : (
            <ErrorState errorCode={failure.errorCode} status={failure.status} />
          )}
          {/*
           * Şerit sayfanın üstünde ve her sayfada duruyor: kapı bir bölümün
           * değil kabuğun eksiği, ve kullanıcı onu bulmak için gezinmek
           * zorunda kalmamalı. Engellemiyor — kabuk kullanılabilir kalıyor.
           */}
          <GateAdvisories gates={advisories} />
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Kabuğun içindeki bilgi kartı.
 *
 * `states.tsx`'teki `EmptyState` sabit metinler taşıyor ve kabuğun anlatacağı
 * şey her seferinde başka; ortak olan yalnız kartın biçimi. Bu yüzden o
 * bileşen genişletilmiyor, kabuğun kendi kartı burada bir kez duruyor.
 */
export function ShellNotice({ title, message }: { title: string; message: string }) {
  return (
    <div role="status" className="state-card">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

/**
 * Kayıtta olan ama henüz teslim edilmemiş bir bölümün adresine gidildiğinde.
 *
 * 404 değil: adres gerçek, yalnız içeriği henüz yok. Kullanıcının menüden
 * gördüğü gerekçenin aynısını burada da okuması, "bağlantıyı mı yanlış
 * yazdım" sorusunu kapatıyor.
 */
export function SectionNotOpen({ section }: { section: Extract<AppSection, { status: "planned" }> }) {
  return <ShellNotice title={section.label} message={section.note} />;
}

/**
 * Menü maddesi.
 *
 * Teslim edilmemiş bölüm bağlantı değil: tıklanabilir bırakılsaydı kullanıcı
 * var olmayan bir adrese gidip 404 görürdü. Nedeni maddenin yanında yazılı
 * duruyor, çünkü "neden tıklayamıyorum" sorusunun cevabı başka bir ekranda
 * olamaz.
 */
function SectionEntry({ section }: { section: AppSection }) {
  if (section.status === "ready") {
    return (
      <Link className="app-nav-link" href={section.href}>
        {section.label}
      </Link>
    );
  }

  return (
    <span className="app-nav-link app-nav-link-planned">
      {section.label}
      <span className="app-nav-note">{section.note}</span>
    </span>
  );
}
