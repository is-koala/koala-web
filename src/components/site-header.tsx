import Link from "next/link";
import { Wordmark } from "@/brand/Wordmark";
import { MobileNav } from "@/components/mobile-nav";
import { SessionNav } from "@/components/session-nav";
import { marketingNav } from "@/lib/site";

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
          <Link className="button button-small" href="/uygulamayi-ac">Uygulamayı aç</Link>
          <MobileNav />
        </div>
      </nav>
    </header>
  );
}
