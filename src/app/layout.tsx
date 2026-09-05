import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { publicEnvironment } from "@/lib/env";
import { site } from "@/lib/site";
import "./globals.css";

const bodyFont = DM_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-body" });
const displayFont = Manrope({ subsets: ["latin", "latin-ext"], variable: "--font-display" });
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
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
