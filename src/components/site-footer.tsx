import Link from "next/link";
import { legalNav, site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-neutral-600">
        <ul className="flex flex-wrap gap-4">
          {legalNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="hover:underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6">
          © {new Date().getFullYear()} {site.name}
        </p>
      </div>
    </footer>
  );
}
