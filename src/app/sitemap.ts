import type { MetadataRoute } from "next";

import { legalCatalog } from "@/content/legal/catalog";
import { publicJobsPath } from "@/lib/app-routes";
import { publicEnvironment } from "@/lib/env";

const publicPaths = [
  "", publicJobsPath, "/is-arayanlar", "/isverenler", "/nasil-calisir", "/hakkimizda", "/iletisim", "/sss", "/hesap-silme",
] as const;

/**
 * Tek tek ilan adresleri (`/is-ilanlari/{id}`) bilerek listelenmiyor: ilanlar
 * günlerce yaşayan kayıtlar ve kapananın adresi site haritasında kalırsa
 * arama motoru sürekli ölü bağlantı tarar. Liste sayfası zaten hepsine
 * bağlantı veriyor ve tarayıcıyı oradan içeri alıyor.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const { siteUrl } = publicEnvironment();
  const legalPaths = Object.entries(legalCatalog).flatMap(([slug, document]) => [
    `/${slug}`,
    `/${slug}/v/${document.version}`,
  ]);
  return [...publicPaths, ...legalPaths].map((path) => ({
    url: new URL(path || "/", siteUrl).toString(),
    changeFrequency: changeFrequency(path),
  }));
}

/**
 * Sürümlenmiş yasal metin donmuş bir belge, tanıtım sayfaları ayda bir
 * değişiyor; ilan listesi ise **her gün** başka: yeni ilan açılıyor, dolan
 * ilan kapanıyor. Üçünü aynı sıklıkla bildirmek, tarayıcıyı en çok değişen
 * sayfayı en seyrek görmeye iterdi.
 */
function changeFrequency(path: string): "never" | "daily" | "monthly" {
  if (path.includes("/v/")) return "never";
  return path === publicJobsPath ? "daily" : "monthly";
}
