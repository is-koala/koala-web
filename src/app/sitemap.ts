import type { MetadataRoute } from "next";

import { legalCatalog } from "@/content/legal/catalog";
import { publicJobPath, publicJobsPath } from "@/lib/app-routes";
import { publicEnvironment } from "@/lib/env";
import { readOpenJobIds } from "@/server/jobs/public-jobs";

const publicPaths = [
  "", publicJobsPath, "/is-arayanlar", "/isverenler", "/nasil-calisir", "/hakkimizda", "/iletisim", "/sss", "/hesap-silme",
] as const;

/**
 * Site haritası ilan sayfalarını da listeliyor.
 *
 * Daha önce listelemiyordu ve gerekçesi kapanan ilanın adresinin haritada
 * kalıp ölü bağlantı taranmasıydı. Gerekçe iki değişiklikle karşılandı:
 * `GET /jobs` yalnız `OPEN` ve süresi geçmemiş ilanları döndürüyor
 * (`JobManager.search`), ve harita `revalidate` ile beş dakikada bir yeniden
 * üretiliyor — yani kapanan ilan bir sonraki üretimde kendiliğinden düşüyor.
 * Karşılığında sayfalar tarayıcıya doğrudan bildiriliyor; liste sayfasından
 * içeri girmeyi beklemek, ilanın ömrü günlerle ölçülürken indekslenmeden
 * kapanmasına yol açıyordu (is-koala/koala-web#21).
 *
 * Süzgeç kombinasyonları **girmiyor** ve bu ayrı bir karar: `/is-ilanlari?…`
 * sonsuz bir URL alanı ve zaten `noindex, follow` alıyor
 * (`(marketing)/is-ilanlari/page.tsx`). Haritaya koymak, indekslenmeyeceğini
 * söylediğimiz adresleri taramaya davet etmek olurdu.
 */
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { siteUrl } = publicEnvironment();
  const legalPaths = Object.entries(legalCatalog).flatMap(([slug, document]) => [
    `/${slug}`,
    `/${slug}/v/${document.version}`,
  ]);
  const jobPaths = (await openJobPaths()).map(publicJobPath);

  return [...publicPaths, ...legalPaths, ...jobPaths].map((path) => ({
    url: new URL(path || "/", siteUrl).toString(),
    changeFrequency: changeFrequency(path),
  }));
}

/**
 * İlanlar okunamazsa harita ilansız üretilir.
 *
 * Backend'e erişilemediğinde `sitemap.xml`'in tamamen 500 dönmesi, tarayıcıya
 * hiçbir sayfayı bildirmemek olurdu — tanıtım ve yasal sayfalar okunabilir
 * durumdayken. Aynı yedek build'i de ayakta tutuyor: `next build` haritayı
 * önceden üretiyor ve backend'siz bir ortamda derleme buna takılmamalı.
 */
async function openJobPaths(): Promise<readonly string[]> {
  try {
    return await readOpenJobIds();
  } catch {
    return [];
  }
}

/**
 * Sürümlenmiş yasal metin donmuş bir belge, tanıtım sayfaları ayda bir
 * değişiyor; ilan listesi ise **her gün** başka: yeni ilan açılıyor, dolan
 * ilan kapanıyor. Üçünü aynı sıklıkla bildirmek, tarayıcıyı en çok değişen
 * sayfayı en seyrek görmeye iterdi.
 *
 * Tek ilan sayfası listeden ayrı: içeriği yayımlandığında donuyor (ADR-0002)
 * ve kapanana kadar değişmiyor, yani günlük taranmasını istemek tarayıcı
 * bütçesini değişmeyen bir sayfaya harcatırdı.
 */
function changeFrequency(path: string): "never" | "daily" | "weekly" | "monthly" {
  if (path.includes("/v/")) return "never";
  if (path === publicJobsPath) return "daily";
  return path.startsWith(`${publicJobsPath}/`) ? "weekly" : "monthly";
}
