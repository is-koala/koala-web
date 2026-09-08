import { site } from "@/lib/site";

import type { JobDetail } from "./contract";

/**
 * İlan sayfasının `schema.org/JobPosting` yapısal verisi.
 *
 * Modül saf ve `server-only` işareti taşımıyor, ama daha önemlisi: sayfadan
 * **ayrı** duruyor. Yapısal veri, ekranda hiç görünmeyen ama arama motorunun
 * okuduğu bir yüzey — yani bir gizlilik sızıntısı buraya düşerse gözle
 * bulunamaz. Ayrı bir modül olduğu için üretilen nesne doğrudan iddiaya
 * konabiliyor; ekranı çizmeden, sayfayı kurmadan.
 *
 * Google'ın süresi geçmiş ilan sayfalarına verdiği ceza yüzünden yapısal veri
 * yalnız `OPEN` ilanda yazılır; kararı `jobPostingJsonLd`'in `null` dönüşü
 * veriyor ve sayfa `<script>` etiketini o zaman hiç çizmiyor.
 */

/** JSON-LD gövdesi; `JSON.stringify` ile yazılacak düz nesne. */
export type JobPostingJsonLd = Readonly<Record<string, unknown>>;

/**
 * Türkiye tek saat dilimi kullanıyor ve 2016'dan beri yaz saati uygulamıyor.
 *
 * `startDateTime`/`endDateTime` backend'den ofsetsiz `LocalDateTime` olarak
 * geliyor ("2026-09-12T18:00:00"). Ofset yazılmazsa `validThrough`'u okuyan
 * taraf onu kendi saat diliminde yorumlar ve ilanın son geçerlilik anı
 * ülkeden ülkeye kayar. Sabit burada duruyor çünkü ekranın saat dilimi bir
 * biçimlendirme tercihi (`src/lib/dates.ts`), buradaki ise sözleşmenin bir
 * parçası.
 */
const turkeyUtcOffset = "+03:00";

/** ISO 3166-1 alpha-2; ürün bugün yalnız Türkiye'de çalışıyor. */
const countryCode = "TR";

/**
 * `SalaryType` → `QuantitativeValue.unitText`.
 *
 * Google birimi bu sabit listeden bekliyor (HOUR, DAY, WEEK, MONTH, YEAR).
 * Okunamayan bir tür birimi düşürüyor: yanlış birim, günlük ücreti saatlik
 * gibi göstererek ilanı olduğundan çok daha cazip yazardı.
 */
const salaryUnits: Readonly<Record<string, string>> = { HOURLY: "HOUR", DAILY: "DAY" };

/**
 * `JobType` → `employmentType`.
 *
 * Google'ın kabul ettiği küme sabit ve Koala'nın iki değeriyle birebir
 * örtüşmüyor; eşleme en yakın karşılığa yapılıyor. Tek seferlik bir gün işi
 * `TEMPORARY`, tekrar eden vardiyalar `PART_TIME`. Okunamayan tür alanı
 * düşürüyor — `OTHER` yazmak, bilmediğimiz bir şeyi biliyormuş gibi
 * bildirmek olurdu.
 */
const employmentTypes: Readonly<Record<string, string>> = {
  ONE_TIME: "TEMPORARY",
  RECURRING: "PART_TIME",
};

/**
 * İlanın yapısal verisi; yazılmaması gerekiyorsa `null`.
 *
 * `canonicalUrl` çağırandan geliyor çünkü mutlak adresi kuran şey ortam
 * değişkeni (`NEXT_PUBLIC_SITE_URL`) ve bu modülün saf kalması, üretilen
 * nesnenin testte ortam kurmadan okunabilmesi demek.
 */
export function jobPostingJsonLd(job: JobDetail, canonicalUrl: string): JobPostingJsonLd | null {
  // Kapanmış, iptal edilmiş ya da durumu okunamayan ilan yapısal veri
  // taşımaz: Google süresi geçmiş ilan sayfalarını cezalandırıyor ve
  // `UNKNOWN` durumda "açık" varsaymak o cezayı sessizce davet ederdi.
  if (job.status !== "OPEN") return null;

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    url: canonicalUrl,
    /*
     * Yedek `duties`, ve bu ekranın kendi yedeğiyle **aynı** karar:
     * `page.tsx`'teki `describe()` arama sonucu açıklamasını zaten
     * `description ?? duties` ile kuruyordu, şema ise yalnız `description`
     * okuyup alanı sessizce düşürüyordu. `description` Google'ın `JobPosting`
     * için zorunlu saydığı beş alandan biri: düştüğü ilan hiç zengin sonuç
     * almıyor. Kısaltma **yok** — 155 karakter arama sonucu kartının sınırı,
     * yapısal veri tam metni taşır.
     */
    ...optional("description", job.description ?? job.duties),
    ...optional("datePosted", job.createdAt),
    ...optional("validThrough", localDateTimeWithOffset(job.endsAt)),
    ...optional("employmentType", employmentTypes[job.type]),
    // `optional` yok: alan zorunlu ve `hiringOrganization` her dalda bir
    // kuruluş döndürüyor.
    hiringOrganization: hiringOrganization(job),
    ...optional("jobLocation", jobLocation(job)),
    ...optional("baseSalary", baseSalary(job)),
    ...optional("totalJobOpenings", job.headcount),
  };
}

/**
 * İşveren kuruluşu — şirket ilanında şirket, bireysel ilanda **platform**.
 *
 * Kişi adı buraya hiç girmiyor ve bu ADR-0003'ün aynı gerekçesi: `creator`
 * gerçek bir kişi, adı bir şirket unvanı değil, ve onu `hiringOrganization`
 * yazmak ilanı açan bireyin adını yapısal veri olarak indekslenebilir hâle
 * getirirdi.
 *
 * Ama alanı **boş bırakmak** da bir seçim değildi. `hiringOrganization`
 * Google'ın `JobPosting` için zorunlu saydığı alanlardan biri; yazılmadığında
 * bireysel ilan doğrulayıcıdan geçmiyor ve hiç zengin sonuç almıyor. Yani
 * is-koala/koala-web#21'in iki şartı — "bireysel işverende kişi adı
 * yazılmasın" ve "Rich Results hatasız" — alan boş kaldığında birbirini
 * kesiyordu.
 *
 * İkisini birden karşılayan hâl bu: ilanı yayımlayan **platform** yazılıyor.
 * Doğru da: ziyaretçi başvurusunu Koala üzerinden yapıyor, işe alan tarafın
 * kimliği ise ekrandaki işveren kartında duruyor.
 */
function hiringOrganization(job: JobDetail): JobPostingJsonLd {
  if (job.companyName === null) return { "@type": "Organization", name: site.name };
  return {
    "@type": "Organization",
    name: job.companyName,
    ...optional("logo", job.companyLogoUrl),
  };
}

/**
 * İş konumu — yalnız ilçe ve il.
 *
 * `streetAddress` ve `geo` bilerek yok: model onları zaten taşımıyor
 * (`src/jobs/contract.ts`), ve taşısaydı bile yapısal veri tam adresi
 * makine tarafından okunabilir hâlde yayımlamanın en doğrudan yolu olurdu.
 */
function jobLocation(job: JobDetail): JobPostingJsonLd | null {
  if (job.cityName === null && job.districtName === null) return null;
  return {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      ...optional("addressLocality", job.districtName),
      ...optional("addressRegion", job.cityName),
      addressCountry: countryCode,
    },
  };
}

/**
 * Ücret — **çalışanın alacağı** tutar.
 *
 * İşveren toplamı değil, ve bu ADR-0002'nin doğrudan sonucu: hizmet bedeli
 * çalışan ödemesinin üstüne ekleniyor, yani `employerTotal` iş arayanın
 * cebine girecek tutardan büyük. Yapısal veriye onu yazmak, ilanı olduğundan
 * yüksek ücretli gösterirdi.
 */
function baseSalary(job: JobDetail): JobPostingJsonLd | null {
  const unitText = salaryUnits[job.salaryType];
  if (job.pricing === null || unitText === undefined) return null;
  return {
    "@type": "MonetaryAmount",
    currency: job.pricing.currency,
    value: {
      "@type": "QuantitativeValue",
      // Tutar dize olarak geçiyor: `PricingBreakdownDto` ondalıkları bilerek
      // dize gönderiyor ve `Number`'a çevirmek backend'in kilitlediği kuruşu
      // kayan noktayla yeniden üretmek olurdu.
      value: job.pricing.workerPayout,
      unitText,
    },
  };
}

/**
 * Ofsetsiz `LocalDateTime`'a Türkiye ofsetini ekler; değer okunamıyorsa `null`.
 *
 * Ayrıştırma yerine biçim denetimi yapılıyor: `new Date(...)` bu dizeyi
 * çalıştığı ortamın saat diliminde yorumlar ve gece yarısına yakın bir bitiş
 * saatini bir gün öteye kaydırırdı.
 */
function localDateTimeWithOffset(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)
    ? `${value.length === 16 ? `${value}:00` : value}${turkeyUtcOffset}`
    : null;
}

/**
 * Değeri olan alanı yazar, olmayanı hiç açmaz.
 *
 * `null` bir alan JSON-LD'de "bilinmiyor" demek değil, "boş" demek: yazılan
 * `null` doğrulayıcıda uyarı üretiyor ve alanın gerçekten yokluğuyla
 * karışıyor.
 */
function optional(key: string, value: unknown): JobPostingJsonLd {
  return value === null || value === undefined || value === "" ? {} : { [key]: value };
}
