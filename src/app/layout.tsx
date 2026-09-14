import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { ConsentManager } from "@/components/consent-manager";
import { publicEnvironment } from "@/lib/env";
import { mainContentId } from "@/lib/landmarks";
import { site } from "@/lib/site";
import "./globals.css";

/**
 * Tasarım sisteminin tek yazı ailesi. Beş ağırlığın dördü yeter: 800 yalnız
 * wordmark içindi ve o artık görsel. `latin-ext` Türkçe harfler için şart.
 */
const sansFont = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
const env = publicEnvironment();

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { siteName: site.name, locale: "tr_TR", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" data-scroll-behavior="smooth">
      <body className={sansFont.variable}>
        <a className="skip-link" href={`#${mainContentId}`}>
          Ana içeriğe geç
        </a>
        {children}
        <ConsentManager />
      </body>
    </html>
  );
}
