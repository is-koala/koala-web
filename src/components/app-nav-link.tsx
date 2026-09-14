"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Kabuk menüsünün bağlantısı; bulunduğu bölümü `aria-current` ile işaretler.
 *
 * Tek istemci parçası bu: menünün geri kalanı sunucuda çiziliyor, yalnız
 * "hangi bölümdeyim" cevabı tarayıcının adresinden okunuyor. Kabuk kökü
 * (`exact`) yalnız birebir eşleşmede seçili; öbür bölümler alt adreslerinde
 * de seçili kalır (`/isveren/ilan/{id}` → "İlanlarım" değil "Yeni ilan" da
 * değil: ilan adresleri hiçbir bölümün altında değil, o yüzden öneki
 * `/isveren/ilanlar` olan adresler eşleşir, `/isveren/ilan/` olanlar eşleşmez).
 */
export function AppNavLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current =
    pathname !== null && (pathname === href || (!exact && pathname.startsWith(`${href}/`)));

  return (
    <Link className="app-nav-link" href={href} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}
