import "server-only";

import { cache } from "react";

import {
  jobTypeValues,
  type JobType as PostedJobType,
  type PricingBreakdown,
} from "@/lib/job-posting";
import { safeImageUrl } from "@/lib/urls";
import type { JobDetail, JobImage } from "@/jobs/contract";
import { jobStatuses } from "@/jobs/lifecycle";
import {
  addressPrecisions,
  clean,
  known,
  salaryTypes,
  type PageDto,
} from "@/server/api/dto";
import { apiFetch } from "@/server/api/client";
import { backendPaths } from "@/server/contract";
import { publicReaderCaller } from "@/server/session/session";

/**
 * İlanların **herkese açık** okuma yüzeyi.
 *
 * Kardeşi `jobs.ts`'ten ayrı bir dosya ve bu bir düzen tercihi değil, bir
 * sınır. İki fark var ve ikisi de sınırın kendisi:
 *
 * - **Oturum yok.** Buradaki çağrılar `apiRequest` değil `apiFetch` kullanıyor
 *   ve token taşımıyor. `jobs.ts` ise başvuru, kapatma ve iptal gibi oturumlu
 *   uçları taşıyor; `src/server/server-only.test.ts` ham istemciyi ada göre
 *   izin veriyor, tam da o dosyanın bir gün sessizce `apiFetch`'e kaymasını
 *   engellemek için. Ayrım dosya düzeyinde durmasa, o kural blunt'laşırdı.
 * - **İstek bağlamı yok.** Ne çerez ne başlık okunuyor, yani bu okumaları
 *   yapan sayfalar ISR ile üretilebiliyor ve ürettikleri HTML ziyaretçiden
 *   bağımsız — ADR-0003 adres kesinliğinin bir oturum kalıntısıyla
 *   `EXACT`e dönmemesi de buradan geliyor.
 *
 * ADR-0011: tarayıcı `api.iskoala.com` ile hiç konuşmuyor; çağrı Next
 * sunucusundan çıkıyor.
 */

/**
 * `GET /jobs/{jobId}` — herkese açık ilan ayrıntısı.
 *
 * Çağrı `apiRequest` yerine **oturumsuz** yapılıyor, tıpkı ilan araması gibi
 * (`src/server/jobs/search.ts`), ve gerekçeleri aynı üçlü:
 *
 * 1. `apiRequest` yenileme tokenı da süresi dolmuşsa kullanıcıyı `/giris`'e
 *    yönlendiriyor. Bu bir tanıtım sayfası; bayat bir çerez yüzünden ilan
 *    bağlantısına tıklayan ziyaretçinin giriş formuna düşmesi kabul edilemez.
 * 2. `JobAddressVisibility.protect` kesinliği bakan kişiye göre seçiyor:
 *    `viewerId` ilanın sahibiyse `EXACT`. Oturumsuz çağrıda yanıt yalnız
 *    ilana bağlı, yani sayfa herkes için aynı ve bir oturum kalıntısı onu
 *    kişiye özel yapamıyor.
 * 3. Çağrı hiçbir istek-zamanı API'si okumuyor (`cookies`, `headers` yok),
 *    yani sayfa gerçekten ISR ile üretilebiliyor. `anonymousCaller()` çerez
 *    okuduğu için rotayı dinamikleştirirdi.
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

/**
 * Site haritasına girecek açık ilanların kimlikleri.
 *
 * `GET /jobs` zaten yalnız `OPEN` ve bitiş tarihi geçmemiş ilanları döndürüyor
 * (`JobManager.search`), yani "açık ilan" süzgeci burada tekrar edilmiyor —
 * sunucunun kuralı ile site haritasının kuralı iki yerde yazılsaydı biri
 * değiştiğinde öbürü sessizce eskirdi.
 *
 * Sayfalama **sınırlı**: site haritası bir tarama girişi, ilanların tam
 * dökümü değil, ve sınırsız bir döngü build'i backend'in ilan sayısına
 * bağlardı. Sınıra dayanıldığında liste kırpılıyor; tarayıcı kalan ilanlara
 * liste sayfasından ulaşıyor.
 *
 * Çağrı `publicReaderCaller` ile gidiyor: site haritası da ziyaretçiden
 * bağımsız ve istek-zamanı API'si okumamalı.
 */
export async function readOpenJobIds(): Promise<readonly string[]> {
  const ids: string[] = [];

  for (let page = 0; page < sitemapPageLimit; page += 1) {
    const search = new URLSearchParams({
      page: String(page),
      size: String(sitemapPageSize),
      sort: "createdAt,desc",
    });
    const response = await apiFetch<PageDto<{ id?: string | null }> | null>(
      `${backendPaths.jobs}?${search}`,
      { ...publicReaderCaller(), cache: "force-cache" },
    );

    for (const job of response?.content ?? []) {
      if (job?.id) ids.push(job.id);
    }
    if (response === null || response.last !== false) break;
  }

  return ids;
}

/** `PageableSanitizer.java:15` tavanı 100'de tutuyor; daha büyüğü sessizce kırpılır. */
const sitemapPageSize = 100;

/** 100 × 50 = 5.000 ilan; Next'in 50.000 URL sınırının çok altında ve sınırlı. */
const sitemapPageLimit = 50;

/** Kimlik tarayıcıdan geliyor; yola konmadan kaçırılır. */
function jobPath(jobId: string): string {
  return `${backendPaths.jobs}/${encodeURIComponent(jobId)}`;
}

/**
 * `JobDetailDto`'nun tel biçimi.
 *
 * `address` bilerek **eksik** yazılmış: yanıt `components`, `position` ve
 * `displayAddress` alanlarını da taşıyor ama bu tip yalnız iki adı tanıyor.
 * Tanımadığı bir alan `toJobDetail` içinde okunamaz, yani sızıntı tipin
 * kendisinde kapanıyor. Alanları buraya geri eklemek, ADR-0003'ün kapattığı
 * yüzeyi tek satırda açar.
 */
type JobDetailDto = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  duties?: string | null;
  dressCode?: string | null;
  category?: { name?: string | null } | null;
  company?: { name?: string | null; logoUrl?: string | null } | null;
  creator?: { firstName?: string | null; lastName?: string | null } | null;
  type?: string | null;
  salaryType?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  createdAt?: string | null;
  pricing?: PricingBreakdown | null;
  minAge?: number | null;
  maxAge?: number | null;
  insuranceRequired?: boolean;
  experienceRequired?: boolean;
  headcount?: number | null;
  hiredCount?: number | null;
  images?: readonly GalleryImageDto[] | null;
  address?: { cityName?: string | null; districtName?: string | null } | null;
  addressPrecision?: string | null;
  status?: string | null;
};

/** `GalleryImageDto`; sıralama backend'den geliyor, kapak bayrağı ayrı bir alan. */
type GalleryImageDto = {
  url?: string | null;
  caption?: string | null;
  cover?: boolean | null;
  sortOrder?: number | null;
};

/**
 * Tel biçimini ekranın modeline daraltır — ve adres yüzeyini burada kapatır.
 *
 * Adresten yalnız `cityName` ve `districtName` geçiyor. `displayAddress`
 * **okunmuyor**, ve bu `addressPrecision`'a bakan bir dallanma değil, koşulsuz
 * bir kural: `JobAddressVisibility.precision()` bakan kişiye bakmadan
 * `publicCompanyAddress` ilanlarında `EXACT` diyor, yani anonim bir ziyaretçi
 * bugün tam sokak adresini ve tam hassasiyetli koordinatı içeren bir yanıt
 * alabiliyor (is-koala/koala-backend#7). Bayrağı okuyup "yaklaşıksa göster"
 * demek, o dalı sızdıran hâlde bırakırdı.
 *
 * Kayıp küçük ve bilinçli: `APPROXIMATE` yanıtta `displayAddress` zaten
 * "mahalle, ilçe, il" idi ve mahalle düşüyor. Karşılığında sayfanın adres
 * yüzeyi tek bir kurala iniyor ve ilan HTML'i ziyaretçiden bağımsız oluyor.
 */
function toJobDetail(dto: JobDetailDto): JobDetail {
  const employerName = [dto.creator?.firstName, dto.creator?.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");

  return {
    id: dto.id ?? "",
    title: dto.title ?? "",
    description: clean(dto.description),
    duties: clean(dto.duties),
    dressCode: clean(dto.dressCode),
    categoryName: clean(dto.category?.name),
    companyName: clean(dto.company?.name),
    companyLogoUrl: safeImageUrl(clean(dto.company?.logoUrl)),
    employerName: employerName || null,
    type: known(dto.type, jobTypes),
    salaryType: known(dto.salaryType, salaryTypes),
    startsAt: dto.startDateTime ?? "",
    endsAt: dto.endDateTime ?? "",
    createdAt: clean(dto.createdAt),
    pricing: toPricing(dto.pricing),
    // Yaş sınırı olmayan ilanda DTO alanı ilkel `int` ve sıfır kalıyor;
    // eksik bir değeri sıfır yaş sanmak "0–0 yaş" yazardı.
    minAge: positiveAge(dto.minAge),
    maxAge: positiveAge(dto.maxAge),
    insuranceRequired: dto.insuranceRequired === true,
    experienceRequired: dto.experienceRequired === true,
    headcount: dto.headcount ?? null,
    hiredCount: dto.hiredCount ?? 0,
    images: toJobImages(dto.images),
    cityName: clean(dto.address?.cityName),
    districtName: clean(dto.address?.districtName),
    // Okunamayan kesinlik `UNKNOWN` kalıyor ve ekran onu yaklaşık gibi
    // etiketliyor: bilinmeyen bir bayrağı "kesin" saymak, ziyaretçiye
    // olduğundan daha kesin bir konum vaat ederdi.
    addressPrecision: known(dto.addressPrecision, addressPrecisions),
    status: known(dto.status, jobStatuses),
  };
}

/**
 * Fiyat anlık görüntüsü ya tam gelir ya hiç.
 *
 * Üç tutardan biri eksikse tamamı düşüyor: yarım bir döküm, çalışanın
 * alacağı ile işverenin ödeyeceği tutarın hangisi olduğunu belirsiz bırakır
 * ve ADR-0002'nin ayrı ayrı gösterme şartını sessizce bozardı.
 */
function toPricing(dto: PricingBreakdown | null | undefined): PricingBreakdown | null {
  if (!dto) return null;
  const currency = clean(dto.currency);
  const workerPayout = clean(dto.workerPayout);
  const serviceFeeAmount = clean(dto.serviceFeeAmount);
  const employerTotal = clean(dto.employerTotal);
  if (!currency || !workerPayout || !serviceFeeAmount || !employerTotal) return null;
  return {
    pricingVersion: dto.pricingVersion ?? "",
    currency,
    workerPayout,
    serviceFeeRate: dto.serviceFeeRate ?? "",
    serviceFeeAmount,
    employerTotal,
  };
}

function positiveAge(value: number | null | undefined): number {
  return typeof value === "number" && value > 0 ? value : 0;
}

/** Adresi olmayan görsel bir görsel değil; kapak sıralaması backend'in. */
function toJobImages(images: readonly GalleryImageDto[] | null | undefined): readonly JobImage[] {
  return (images ?? []).flatMap((image) => {
    const url = safeImageUrl(clean(image?.url));
    return url === null
      ? []
      : [{ url, caption: clean(image?.caption), cover: image?.cover === true }];
  });
}

/** Yalnız bu çeviricide okunuyor; `jobTypeValues` zaten tek kaynak. */
const jobTypes = new Set<PostedJobType>(jobTypeValues);
