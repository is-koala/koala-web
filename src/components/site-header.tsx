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
 * Hap artık oturum çağrısı (giriş ya da kullanıcının paneli); "Uygulamayı aç"
 * yanında metin bağlantısı. Dar ekranda `.nav-links` gizlenir ve `MobileNav`
 * devreye girer.
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
          {/*
            Asıl çağrı oturuma göre değişiyor (`SessionNav`: giriş ya da kabuk);
            uygulama bağlantısı ikincil — web akışı artık kendi başına yetiyor
            (is-koala/koala-web#154), uygulama bir seçenek.
          */}
          <Link className="nav-auth-link nav-app-link" href="/uygulamayi-ac">Uygulamayı aç</Link>
          <SessionNav />
          <MobileNav />
        </div>
      </nav>
    </header>
  );
}
