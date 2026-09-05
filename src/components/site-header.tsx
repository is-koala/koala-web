import Link from "next/link";
import { Wordmark } from "@/brand/Wordmark";
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
        <Link className="button button-small" href="/uygulamayi-ac">Uygulamayı aç</Link>
      </nav>
    </header>
  );
}
