import Link from "next/link";
import { Wordmark } from "@/brand/Wordmark";
import { companyNav, legalNav, site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div><Wordmark /><p>Bugünün işi, bugünün insanı.</p></div>
        <ul className="footer-links">
          {companyNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>
                {item.label}
              </Link>
            </li>
          ))}
          <li><Link href="/hesap-silme">Hesap Silme</Link></li>
          {legalNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        {/*
          Telif satırında yıl **bilerek yok**. Yıl, statik üretilen sayfalarda
          (`AGENTS.md` § Yapı: tanıtım sayfaları statik üretilir) build anında
          HTML'e ve RSC payload'ına sabit sayı olarak gömülüyordu; 1 Ocak'tan
          sonra site yeniden deploy edilene kadar ziyaretçi eski yılı görürdü.
          Ayrıca çalıştığı ortamın `TZ`'sine bağlıydı.

          Bunu ISR ya da istemcide çizimle çözmek, yılda bir kez değişen
          kozmetik bir dize için sırasıyla çalışma zamanı makinesi ve istemci
          JS'i eklemek olurdu. Telif ihbarı yılı zorunlu tutmuyor, o yüzden
          kaynağı kurutuldu (is-koala/koala-web#90).
        */}
        <p className="copyright">© {site.name}</p>
      </div>
    </footer>
  );
}
