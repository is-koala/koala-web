import Image from "next/image";
import Link from "next/link";

import { controllerIdentity } from "@/content/support";
import { companyNav, legalNav, marketingNav, site } from "@/lib/site";

import lockup from "../../public/brand/lockup-green.png";

/* 778×320; Vitest görseli düz yol olarak çözdüğü için oran elle yazılı. */
const lockupRatio = 778 / 320;

const columns = [
  { title: "Ürün", links: marketingNav },
  { title: "Kurumsal", links: [...companyNav, { href: "/hesap-silme", label: "Hesap Silme" }] },
  { title: "Yasal", links: legalNav },
] as const;

/**
 * Altbilgi: koyu zemin, marka sütunu ve üç bağlantı sütunu (mockup #155).
 * Mockup'taki Instagram/LinkedIn bağlantılarının gerçek adresi yok, o yüzden
 * İletişim sütunu yalnız e-posta ve formu taşıyor.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Link href="/" aria-label="Koala ana sayfa" className="footer-lockup">
            <Image src={lockup} alt="" height={44} width={Math.round(lockupRatio * 44)} style={{ height: 44, width: "auto" }} />
          </Link>
          <p>{"Öğrenciler için günlük iş ilanları. İstanbul'da başlıyoruz."}</p>
        </div>
        {columns.map((column) => (
          <div key={column.title} className="footer-column">
            <p className="footer-column-title">{column.title}</p>
            <ul className="footer-links">
              {column.links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="footer-column">
          <p className="footer-column-title">İletişim</p>
          <ul className="footer-links">
            <li>
              <a href={`mailto:${controllerIdentity.email}`}>{controllerIdentity.email}</a>
            </li>
            <li>
              <Link href="/iletisim">Destek formu</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
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
        <p className="copyright">© {site.name}. Tüm hakları saklıdır.</p>
        <p className="footer-place">Yıldız Teknik Üniversitesi, İstanbul</p>
      </div>
    </footer>
  );
}
