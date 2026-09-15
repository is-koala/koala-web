import "server-only";

import { safeImageUrl } from "@/lib/urls";
import type { JobDetail, JobImage, JobPricing } from "@/jobs/contract";
import { jobStatuses } from "@/jobs/lifecycle";
import { clean, jobTypes, known, openings, precisionOf, salaryTypes } from "@/server/api/dto";
import { toPublicTransportSummary, type JobTransportDto } from "@/server/transport/dto";

/**
 * `JobDetailDto`'nun tel biçimi ve onu ekran modeline daraltan çevirici.
 *
 * İki okuyucu paylaşıyor: herkese açık ilan sayfası (`public-jobs.ts`,
 * oturumsuz) ve işverenin kendi ilan sayfası (`jobs.ts`, oturumlu). Aynı
 * yanıtı iki yerde ayrı ayrı okumak, alanlardan biri düzeltildiğinde öbürünün
 * sessizce eski kalması demekti (is-koala/koala-web#166). Modül `apiFetch`
 * içe aktarmıyor; hangi kademeden çağrıldığına bakmadan yalnız biçimi çevirir.
 *
 * `address` bilerek **eksik** yazılmış: yanıt `components`, `position` ve
 * `displayAddress` alanlarını da taşıyor ama bu tip yalnız iki adı tanıyor.
 * Tanımadığı bir alan `toJobDetail` içinde okunamaz, yani sızıntı tipin
 * kendisinde kapanıyor. Alanları buraya geri eklemek, ADR-0003'ün kapattığı
 * yüzeyi tek satırda açar. İşverenin kendi ilanında okunan `displayAddress`
 * bu tipin **dışında**, `jobs.ts` içindeki genişletmede duruyor.
 */
export type JobDetailDto = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  duties?: string | null;
  dressCode?: string | null;
  category?: { name?: string | null } | null;
  company?: { name?: string | null; logoUrl?: string | null } | null;
  creator?: { id?: string | null; firstName?: string | null; lastName?: string | null } | null;
  type?: string | null;
  salaryType?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  createdAt?: string | null;
  pricing?: PricingDto | null;
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
  transport?: JobTransportDto | null;
};

/**
 * `PricingBreakdownDto`'nun tel biçimi. Ücret alanları bakan kişiye göre
 * **null** gelebiliyor (is-koala/koala-backend#304); eski sunucu herkese tam
 * dökümü gönderiyordu ve iki biçim de aynı çeviriciden geçiyor.
 */
export type PricingDto = {
  pricingVersion?: string | null;
  currency?: string | null;
  workerPayout?: string | null;
  serviceFeeRate?: string | null;
  serviceFeeAmount?: string | null;
  employerTotal?: string | null;
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
export function toJobDetail(dto: JobDetailDto): JobDetail {
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
    employerId: clean(dto.creator?.id),
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
    transport: toPublicTransportSummary(dto.transport),
  };
}

/**
 * Fiyat anlık görüntüsü: kazanç zorunlu, döküm bakan kişiye göre.
 *
 * `workerPayout` ile `currency` yoksa tamamı düşüyor — kazanç, ilanın
 * ziyaretçiye söylediği tek tutar. Hizmet bedeli ile işveren toplamı ise
 * birlikte ya geliyor ya hiç: backend herkese açık görünümde ikisini de null
 * gönderiyor (is-koala/koala-backend#304) ve bu bir eksiklik değil, bir
 * görünüm. Yalnız birinin gelmesi ise yarım bir döküm; o da düşüyor, çünkü
 * çalışanın alacağı ile işverenin ödeyeceği tutarın hangisi olduğunu belirsiz
 * bırakır ve ADR-0002'nin ayrı ayrı gösterme şartını sessizce bozardı.
 * Eski kural üç tutarı da zorunlu sayıyordu ve yeni sunucuda kazancı da
 * silip ilan sayfasına "Kazanç bilgisi paylaşılmadı" yazdırıyordu
 * (is-koala/koala-web#181).
 */
export function toPricing(dto: PricingDto | null | undefined): JobPricing | null {
  if (!dto) return null;
  const currency = clean(dto.currency);
  const workerPayout = clean(dto.workerPayout);
  if (!currency || !workerPayout) return null;
  const serviceFeeAmount = clean(dto.serviceFeeAmount);
  const employerTotal = clean(dto.employerTotal);
  const breakdown = serviceFeeAmount !== null && employerTotal !== null;
  return {
    pricingVersion: dto.pricingVersion ?? "",
    currency,
    workerPayout,
    serviceFeeRate: breakdown ? clean(dto.serviceFeeRate) : null,
    serviceFeeAmount: breakdown ? serviceFeeAmount : null,
    employerTotal: breakdown ? employerTotal : null,
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
