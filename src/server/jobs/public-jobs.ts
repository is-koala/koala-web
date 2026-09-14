import "server-only";

import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import type { EmployerStats, JobDetail } from "@/jobs/contract";
import { apiFetch } from "@/server/api/client";
import { backendPaths, employerStatsPath, jobPath, jobSitemapShardPath } from "@/server/contract";
import { toJobDetail, type JobDetailDto } from "@/server/jobs/job-detail-dto";
import { publicReaderCaller } from "@/server/session/session";

/**
 * İlanların **istek bağlamı taşımayan** okuma yüzeyi.
 *
 * Eksen "oturumlu/oturumsuz" **değil** ve daha önce öyle yazılmıştı: kardeşi
 * `search.ts` de oturumsuz bir kamu okuması, yani o eksen bu dosyanın neden
 * ayrı durduğunu açıklamıyordu. Ayıran şey istek bağlamı, ve üç kademe var:
 *
 * 1. **Oturumlu** — `apiRequest` (`jobs.ts`): token taşıyor, 401'de yeniliyor,
 *    yenileme de düşmüşse `/giris`'e yönlendiriyor. Başvuru, kapatma, iptal.
 * 2. **Oturumsuz ama istek bağlamlı** — `anonymousCaller()` (`search.ts`):
 *    token yok, ama çerezden cihaz kimliğini ve başlıktan ziyaretçinin
 *    IP'sini okuyor. `cookies()`/`headers()` çağırdığı için kullandığı sayfa
 *    dinamik render'a düşüyor — arama sayfası zaten `searchParams` okuduğu
 *    için dinamik, yani kayıp yok.
 * 3. **İstek bağlamı da yok** — `publicReaderCaller()` (bu dosya): ne çerez
 *    ne başlık. Sayfalar ISR ile üretilebiliyor ve ürettikleri HTML
 *    ziyaretçiden bağımsız; ADR-0003 adres kesinliğinin bir oturum
 *    kalıntısıyla `EXACT`e dönmemesi de buradan geliyor.
 *
 * **2. kademe 3'e indirilemez** ve sebebi ölçülü: `RateLimitFilter`
 * `/jobs` ile `/jobs/{jobId}`'yi `PUBLIC` kovasına koyuyor ve kovanın
 * anahtarını `clientIpResolver.resolve(request)` ile, yani **istemci IP'siyle**
 * kuruyor (`RateLimitFilter.java:179-186`). Arama her tuşta backend'e gidiyor;
 * IP'yi iletmemek bütün ziyaretçileri Next sunucusunun tek IP'sinde aynı
 * kovaya toplar ve tek bir yoğun kullanıcı siteyi herkese kapatırdı. Ayrıntı
 * okuması ise ISR arkasında: aynı ilan için beş dakikada en çok bir kez
 * backend'e gidiyor, yani paylaşılan kova bir yük üretmiyor.
 *
 * ADR-0011: tarayıcı `api.iskoala.com` ile hiç konuşmuyor; çağrı Next
 * sunucusundan çıkıyor.
 */

/**
 * `GET /jobs/{jobId}` — herkese açık ilan ayrıntısı.
 *
 * İlk iki gerekçe ilan aramasıyla ortak (`src/server/jobs/search.ts`), üçüncüsü
 * bu dosyayı ondan da ayıran şey:
 *
 * 1. `apiRequest` yenileme tokenı da süresi dolmuşsa kullanıcıyı `/giris`'e
 *    yönlendiriyor. Bu bir tanıtım sayfası; bayat bir çerez yüzünden ilan
 *    bağlantısına tıklayan ziyaretçinin giriş formuna düşmesi kabul edilemez.
 * 2. `JobAddressVisibility.protect` kesinliği bakan kişiye göre seçiyor:
 *    `viewerId` ilanın sahibiyse `EXACT`. Oturumsuz çağrıda yanıt yalnız
 *    ilana bağlı, yani sayfa herkes için aynı ve bir oturum kalıntısı onu
 *    kişiye özel yapamıyor.
 * 3. Çağrı hiçbir istek-zamanı API'si okumuyor (`cookies`, `headers` yok),
 *    yani sayfa gerçekten ISR ile üretilebiliyor. Arama bunu karşılamıyor:
 *    `anonymousCaller()` çerez ve başlık okuyor. Ayrımın bedeli ve karşılığı
 *    modül başlığında.
 *
 * `React.cache`, aynı render içinde `generateMetadata` ile sayfanın ilanı iki
 * kez çekmesini engelliyor.
 */
export const readJobDetail = cache(async (jobId: string): Promise<JobDetail | null> => {
  const dto = await apiFetch<JobDetailDto | null>(jobPath(jobId), {
    ...publicReaderCaller(),
    cache: "force-cache",
  });
  return dto === null ? null : toJobDetail(dto);
});

const sitemapBackendTimeoutMilliseconds = 30_000;

/**
 * İlan sitemap manifesti de bu katmanın kamu okumasıdır: token yok, çerez
 * yok, IP yok. Ham `apiFetch`'i SEO katmanına açmak, oturumlu yenileme
 * kapısını o dosyadan sessizce atlatırdı.
 */
export function fetchJobSitemapManifest(): Promise<unknown> {
  return apiFetch<unknown>(backendPaths.jobSitemapManifest, sitemapPublicRequest());
}

export function fetchJobSitemapShard(version: string, shard: number): Promise<unknown> {
  return apiFetch<unknown>(jobSitemapShardPath(version, shard), sitemapPublicRequest());
}

function sitemapPublicRequest() {
  return {
    ...publicReaderCaller(),
    cache: "no-store" as const,
    signal: AbortSignal.timeout(sitemapBackendTimeoutMilliseconds),
  };
}

/** `EmployerStatsDto`; `userId` ve `reviewCount` da geliyor, kart dördünü çiziyor. */
type EmployerStatsDto = {
  jobsPosted?: number | null;
  completedJobs?: number | null;
  averageRating?: string | number | null;
  reviewCount?: number | null;
  memberSince?: string | null;
};

/**
 * `GET /users/{userId}/employer-stats` — ilan sayfasının işveren güven kartı.
 *
 * Uç `permitAll` (`SecurityConfig`) ve değerler her istekte türetiliyor; bu
 * yüzden ilanla aynı kademeden, oturumsuz ve istek bağlamsız okunuyor ki
 * sayfa ISR'da kalsın. Kart ikincil: okunamazsa `null` döner ve sayfa kartsız
 * çizilir — ilanın kendisi için geçerli olan "geçici hatayı at" kuralı
 * (`loadJob`) burada uygulanmıyor, çünkü bir istatistik satırı yüzünden ilanı
 * 500'e düşürmek ziyaretçiye ilanı hiç göstermemek olurdu. Bedeli bilinçli:
 * arıza anında üretilen sayfa beş dakika kartsız kalır.
 *
 * `averageRating` **dize** olarak taşınıyor: backend `BigDecimal` gönderiyor
 * ve yuvarlamayı istemcide yeniden üretmek yanlış sayı yazardı.
 */
export const readEmployerStats = cache(async (userId: string): Promise<EmployerStats | null> => {
  try {
    const dto = await apiFetch<EmployerStatsDto | null>(employerStatsPath(userId), {
      ...publicReaderCaller(),
      cache: "force-cache",
    });
    if (dto === null) return null;
    return {
      jobsPosted: dto.jobsPosted ?? 0,
      completedJobs: dto.completedJobs ?? 0,
      reviewCount: dto.reviewCount ?? 0,
      averageRating:
        dto.averageRating === null || dto.averageRating === undefined
          ? null
          : String(dto.averageRating),
      memberSince: dto.memberSince?.trim() || null,
    };
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
});
