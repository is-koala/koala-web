import Link from "next/link";
import { Wordmark } from "@/brand/Wordmark";
import { MobileNav } from "@/components/mobile-nav";
import { SessionNav } from "@/components/session-nav";
import { marketingNav } from "@/lib/site";

/**
 * Tanıtım başlığı: marka imzası, ürün bağlantıları, oturum ve uygulama çağrısı.
 *
 * Yerleşim tasarımcının v2 mockup'ından (#155): yapışkan beyaz bant, ince alt
 * çizgi, sağda hap biçimli yeşil çağrı. Bağlantı kümesi mockup'taki bölüm
 * çıpaları değil sitenin gerçek rotaları — mockup tek sayfaydı, site değil.
 * Dar ekranda `.nav-links` gizlenir ve `MobileNav` devreye girer.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Ana menü">
        <Wordmark />
        <ul className="nav-links">
          {marketingNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="nav-actions">
          <SessionNav />
          <Link className="button button-primary button-small" href="/uygulamayi-ac">Uygulamayı aç</Link>
          <MobileNav />
        </div>
      </nav>
    </header>
  );
}
