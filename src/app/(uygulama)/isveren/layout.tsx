import type { Metadata } from "next";

import { ShellLayout } from "../shell";

export const metadata: Metadata = {
  title: "İşveren",
  robots: { index: false, follow: false },
};

/**
 * Kabuğun altında hiçbir şey önceden üretilemez: her sayfa oturumu ve profili
 * istek başına çözüyor, bir derleme anı görüntüsü ya bir kullanıcının menüsünü
 * HTML'e gömerdi ya da `next build` sırasında backend'in ayakta olmasını
 * isterdi. `cookies()` bunu zaten zorluyor; söylemek keşfetmekten ucuz.
 */
export const dynamic = "force-dynamic";

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ShellLayout shell="employer">{children}</ShellLayout>;
}
