import "server-only";

import { cache } from "react";

import { jobPageSize } from "@/jobs/contract";
import { jobStatuses } from "@/jobs/lifecycle";
import {
  backendJobSearchParams,
  type JobFilterOptions,
  type JobSearchPage,
  type JobSearchQuery,
  type JobSummary,
  type ReferenceOption,
} from "@/jobs/search";
import { emptyBackendPage } from "@/lib/pagination";
import {
  clean,
  employerTypes,
  jobTypes,
  known,
  openings,
  precisionOf,
  salaryTypes,
  type PageDto,
} from "@/server/api/dto";
import { backendPaths } from "@/server/contract";
import { apiFetch } from "@/server/api/client";
import { anonymousCaller } from "@/server/session/session";

/**
 * Herkese açık ilan aramasının sunucu tarafı.
 *
 * ADR-0011: tarayıcı `api.iskoala.com` ile hiç konuşmuyor, çağrı Next
 * sunucusundan çıkıyor ve backend adresi istemci bundle'ına hiç girmiyor.
 *
 * Çağrı `apiRequest` yerine **anonim** yapılıyor ve bu iki sebeple bilinçli:
 *
 * 1. `apiRequest` yenileme tokenı da süresi dolmuşsa kullanıcıyı `/giris`'e
 *    yönlendiriyor. Bu herkese açık bir tanıtım sayfası; bayat bir çereze sahip
 *    ziyaretçinin iş ararken giriş formuna düşmesi kabul edilemez.
 * 2. `JobAddressVisibility.protect` kesinliği **bakan kişiye** göre seçiyor
 *    (`viewerId` ilanın sahibiyse `EXACT`). Oturum taşımayan bir çağrıda yanıt
 *    yalnız ilana bağlı: liste herkes için aynı, ve ADR-0003'ün yaklaşık
 *    konumu bir oturum kalıntısı yüzünden kesinleşemez.
 *
 * `GET /jobs` zaten kimlik istemiyor (`SecurityConfig` `permitAll`), yani
 * anonim çağrı bir yetenek kaybı değil.
 */

/**
 * `GET /jobs` — süzgeçli, sayfalı ilan listesi.
 *
 * **Önbellek kararı: `no-store`.** Liste taze olmak zorunda — sunucu yalnız
 * `OPEN` ilanları döndürüyor, yani önbellekten gelen bir sayfa kapanmış bir
 * ilanı açıkmış gibi gösterir ve ziyaretçi başvuramayacağı bir işe tıklar.
 * Bunun bedeli her görüntülemenin bir backend çağrısı olması ve `GET /jobs`'un
 * dakikada 120 istekle sınırlı `PUBLIC` kovasında durması
 * (`RateLimitProperties.publicBucket`). Kova anahtarı istemci IP'si, ve BFF
 * gerçek IP'yi `X-Forwarded-For` olarak zaten yazıyor (`apiFetch`), yani
 * ziyaretçiler tek bir kovayı paylaşmıyor. Süzgeç sözlükleri ayrı: onlar
 * ziyaretçiden bağımsız ve aşağıda önbellekleniyor.
 */
export async function searchJobs(query: JobSearchQuery): Promise<JobSearchPage> {
  const search = backendJobSearchParams(query);
  const page = await apiFetch<PageDto<JobSummaryDto> | null>(`${backendPaths.jobs}?${search}`, {
    ...(await anonymousCaller()),
    cache: "no-store",
  });

  // `query.page` kullanıcıya görünen 1 tabanlı numara; zarf 0 tabanlı.
  if (page === null) return emptyBackendPage<JobSummary>(query.page - 1, jobPageSize);

  return {
    content: (page.content ?? []).map(toJobSummary),
    page: page.page ?? query.page - 1,
    size: page.size ?? jobPageSize,
    totalElements: page.totalElements ?? 0,
    totalPages: page.totalPages ?? 0,
    first: page.first ?? query.page === 1,
    last: page.last ?? true,
  };
}

/**
 * Süzgeç sözlükleri.
 *
 * **Önbellek kararı: `force-cache`.** Kategoriler, iller ve ilçeler yılda bir
 * değişse çok; her ilan aramasında üç tur atmaları anlamsız. `React.cache`
 * aynı render içinde tekrarı, `force-cache` ise turlar arası yeniden
 * kullanımı kesiyor. İkincisi ziyaretçiler arasında tam paylaşılmıyor —
 * `X-Device-Id` her tarayıcı profilinde farklı ve Next'in veri önbelleği
 * anahtarına başlıklar da giriyor — ama sözlükler `PUBLIC` hız sınırı
 * kovasında olmadığı için asıl korunan şey tazelik değil gecikme.
 */
export const readJobFilterOptions = cache(
  async (cityId: string | null): Promise<JobFilterOptions> => {
    const [categories, cities] = await Promise.all([readJobCategories(), readTurkishCities()]);
    return {
      categories,
      cities,
      districts: cityId === null ? [] : await readDistricts(cityId),
    };
  },
);

function readJobCategories(): Promise<readonly ReferenceOption[]> {
  return referenceList(backendPaths.jobCategories);
}

/**
 * Türkiye'nin illeri.
 *
 * `GET /reference/cities` diye bir uç **yok**: iller yalnız bir ülkenin altında
 * duruyor (`ReferenceDataController` `GET /reference/countries/{countryId}/cities`),
 * yani önce ülke listesinden Türkiye'nin kimliği bulunmalı. Eşleşme ada değil
 * ISO koduna bakıyor; `CountryDto.code` sabit, görünen ad değil.
 */
async function readTurkishCities(): Promise<readonly ReferenceOption[]> {
  const countries = await referenceList<CountryDto>(backendPaths.referenceCountries);
  const turkey = countries.find((country) => country.code?.toUpperCase() === turkeyCountryCode);
  if (turkey === undefined) return [];
  return referenceList(`${backendPaths.referenceCountries}/${turkey.id}/cities`);
}

function readDistricts(cityId: string): Promise<readonly ReferenceOption[]> {
  return referenceList(`${backendPaths.referenceCities}/${cityId}/districts`);
}

/** ISO 3166-1 alpha-2. */
const turkeyCountryCode = "TR";

type CountryDto = ReferenceOption & { readonly code?: string | null };

async function referenceList<T extends ReferenceOption>(path: string): Promise<readonly T[]> {
  const list = await apiFetch<readonly T[] | null>(path, {
    ...(await anonymousCaller()),
    cache: "force-cache",
  });
  return (list ?? []).filter((option) => Boolean(option?.id) && Boolean(option?.name));
}

type JobSummaryDto = {
  id?: string | null;
  title?: string | null;
  position?: string | null;
  sector?: string | null;
  category?: { id?: string | null; name?: string | null; code?: string | null } | null;
  employerType?: string | null;
  type?: string | null;
  salaryType?: string | null;
  salary?: number | string | null;
  pricing?: { workerPayout?: string | null; currency?: string | null } | null;
  insuranceRequired?: boolean | null;
  experienceRequired?: boolean | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  status?: string | null;
  cityName?: string | null;
  districtName?: string | null;
  companyName?: string | null;
  coverImageUrl?: string | null;
  applicationCount?: number | null;
  headcount?: number | null;
  hiredCount?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  addressPrecision?: string | null;
};

function toJobSummary(dto: JobSummaryDto): JobSummary {
  return {
    id: dto.id ?? "",
    title: dto.title ?? "",
    position: clean(dto.position),
    sector: clean(dto.sector),
    categoryId: clean(dto.category?.id),
    categoryName: clean(dto.category?.name),
    categoryCode: clean(dto.category?.code),
    employerType: known(dto.employerType, employerTypes),
    type: known(dto.type, jobTypes),
    salaryType: known(dto.salaryType, salaryTypes),
    // Tutarlar dize olarak taşınıyor: `PricingBreakdownDto` ondalıkları bilerek
    // dize gönderiyor ve `salary` de `Number`'a çevrilirse backend yuvarlaması
    // kayan noktayla yeniden üretilmiş olurdu.
    salary: decimal(dto.salary),
    workerPayout: clean(dto.pricing?.workerPayout),
    currency: clean(dto.pricing?.currency),
    insuranceRequired: dto.insuranceRequired === true,
    experienceRequired: dto.experienceRequired === true,
    startsAt: dto.startDateTime ?? "",
    endsAt: dto.endDateTime ?? "",
    status: known(dto.status, jobStatuses),
    cityName: clean(dto.cityName),
    districtName: clean(dto.districtName),
    companyName: clean(dto.companyName),
    coverImageUrl: clean(dto.coverImageUrl),
    applicationCount: dto.applicationCount ?? 0,
    ...openings(dto),
    latitude: typeof dto.latitude === "number" ? dto.latitude : null,
    longitude: typeof dto.longitude === "number" ? dto.longitude : null,
    addressPrecision: precisionOf(dto.addressPrecision),
  };
}

/** Jackson `BigDecimal`'i sayı olarak serileştiriyor; ekrana giden biçim dize. */
function decimal(value: number | string | null | undefined): string | null {
  if (typeof value === "string") return value.trim() || null;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}
