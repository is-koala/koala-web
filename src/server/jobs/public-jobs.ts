import "server-only";

import { cache } from "react";

import type { PricingBreakdown } from "@/lib/job-posting";
import { safeImageUrl } from "@/lib/urls";
import type { JobDetail, JobImage } from "@/jobs/contract";
import { jobStatuses } from "@/jobs/lifecycle";
import {
  clean,
  jobTypes,
  known,
  openings,
  precisionOf,
  salaryTypes,
} from "@/server/api/dto";
import { apiFetch } from "@/server/api/client";
import { jobPath } from "@/server/contract";
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
  acceptingApplications?: boolean | null;
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
    ...openings(dto),
    images: toJobImages(dto.images),
    cityName: clean(dto.address?.cityName),
    districtName: clean(dto.address?.districtName),
    addressPrecision: precisionOf(dto.addressPrecision),
    status: known(dto.status, jobStatuses),
    // Alan eski/eksik bir backend yanıtında yoksa başvuru ve indeksleme
    // yüzeylerini açık bırakmak yerine güvenli biçimde kapat.
    acceptingApplications: dto.acceptingApplications === true,
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
