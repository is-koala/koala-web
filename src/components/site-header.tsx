import Link from "next/link";
import { marketingNav, site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        {/* Logo henüz yok; gelene kadar kelime markası duruyor. */}
        <Link href="/" className="text-lg font-semibold">
          {site.name}
        </Link>
        <ul className="hidden gap-6 text-sm md:flex">
          {marketingNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="hover:underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
