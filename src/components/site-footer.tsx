import Link from "next/link";
import { Wordmark } from "@/brand/Wordmark";
import { legalNav, site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div><Wordmark /><p>Bugünün işi, bugünün insanı.</p></div>
        <ul className="footer-links">
          <li><Link href="/hesap-silme">Hesap Silme</Link></li>
          {legalNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="copyright">
          © {new Date().getFullYear()} {site.name}
        </p>
      </div>
    </footer>
  );
}
