import type { JobType, PricingBreakdown } from "@/lib/job-posting";

import type { JobStatus } from "./lifecycle";

export type SalaryType = "HOURLY" | "DAILY" | "UNKNOWN";

/**
 * Bir **yanıttan** okunmuş ilan türü; okunamayan değer `UNKNOWN` olur ve
 * ekranda tür satırı düşer.
 *
 * `JobType`'tan (`@/lib/job-posting`) ayrı bir ad taşıyor ve bu ayrım kasıtlı:
 * o tip bir **seçim** kümesi — ilan formunun ve arama süzgecinin
 * yazabileceği değerler — burada ise okunamamış olma ihtimali de var.
 * `UNKNOWN`'ı seçim kümesine katmak, adres çubuğuna `?tur=UNKNOWN` yazılınca
 * sunucuda karşılığı olmayan bir enum sabiti göndermek olurdu.
 *
 * Aynı tip daha önce iki addaydı — burada `JobType`, `jobs/search.ts` içinde
 * `JobTypeValue` — ve buradaki ad `@/lib/job-posting`'inkiyle çakıştığı için
 * iki dosya `PostedJobType` takma adı yazmak zorunda kalıyordu. Tek ad, ve
 * çakışmayan olanı.
 */
export type JobTypeValue = JobType | "UNKNOWN";

export type AddressPrecision = "APPROXIMATE" | "EXACT" | "UNKNOWN";

/**
 * İlan listelerinin sayfa boyutu.
 *
 * **Tek** sabit, çünkü tek bir sunucu varsayılanı var: yirmi hem
 * `@PageableDefault` değeri hem de mobilin `JobService.defaultPageSize`'ı.
 * Herkese açık arama ile "İlanlarım" listesi bunu iki ayrı sabitte tutuyordu;
 * biri değiştiğinde öbürü sessizce eskir ve aynı uç iki farklı dilimle
 * okunurdu.
 *
 * Adres çubuğundan değiştirilemiyor ve bu da bilinçli: `PageableSanitizer.java:15`
 * tavanı 100'de tutuyor, ama asıl mesele her sayfa boyutunun ayrı bir
 * indekslenebilir URL üretmesi.
 */
export const jobPageSize = 20;

/** Galeri görseli; `url` `safeImageUrl` kapısından geçmiş hâliyle taşınır. */
export type JobImage = {
  readonly url: string;
  readonly caption: string | null;
  readonly cover: boolean;
};

/**
 * İlan ayrıntısı ekranının backend yanıtından aldığı dar, salt-okunur model.
 *
 * Model bir görünüm tercihi değil, bir **gizlilik sınırı**. `JobDetailDto`
 * adres nesnesinin tamamını taşıyor — `components` (sokak, bina, kat, daire,
 * posta kodu), `position` (koordinat) ve `displayAddress` — ve bu uç kimlik
 * doğrulaması istemiyor (`SecurityConfig` `permitAll`). Bu tipte o alanların
 * karşılığı **yok**: bir sunucu bileşeni onları yanlışlıkla çizemez, çünkü
 * modele hiç girmiyorlar. Ayıklama `toJobDetail` içinde, tel biçiminden
 * modele geçerken yapılıyor.
 */
export type JobDetail = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly duties: string | null;
  readonly dressCode: string | null;
  readonly categoryName: string | null;
  readonly companyName: string | null;
  readonly companyLogoUrl: string | null;
  readonly employerName: string | null;
  readonly type: JobTypeValue;
  readonly salaryType: SalaryType;
  readonly startsAt: string;
  readonly endsAt: string;
  /** `Instant`; yapısal verinin `datePosted` alanı buradan çıkıyor. */
  readonly createdAt: string | null;
  /**
   * İlan yayımlanırken kilitlenen fiyat anlık görüntüsü (ADR-0002).
   *
   * Tek parça taşınıyor çünkü tek bir karar: çalışan ücreti, hizmet bedeli ve
   * işveren toplamı aynı anda donduruluyor ve biri öbürleri olmadan
   * gösterilirse ekran, işverenin ödediği ile çalışanın aldığı tutarı
   * karıştırır. Snapshot'ı olmayan ilanda `null`; `salary` alanından yeniden
   * üretmek kilitlenmiş tutarla ayrışabilirdi.
   */
  readonly pricing: PricingBreakdown | null;
  /** `0` "belirtilmedi" demek: DTO alanı ilkel `int` ve yaş sınırı yoksa sıfır kalıyor. */
  readonly minAge: number;
  readonly maxAge: number;
  readonly insuranceRequired: boolean;
  readonly experienceRequired: boolean;
  /** İkisinin de okunma kuralı `openings` içinde (`@/server/api/dto`). */
  readonly headcount: number | null;
  readonly hiredCount: number;
  readonly images: readonly JobImage[];
  /** İl adı — adresten ekrana çıkan iki alandan biri (ADR-0003). */
  readonly cityName: string | null;
  /** İlçe adı — adresten ekrana çıkan öbür alan. */
  readonly districtName: string | null;
  /**
   * Backend'in bildirdiği adres kesinliği.
   *
   * Ekranda yalnız **etiket** seçiyor ("Yaklaşık konum" / "Konum"); hangi
   * alanların taşındığını seçmiyor. İkisi bilerek ayrı: `EXACT` yanıtı da
   * yalnız il ve ilçe taşıyor, yani bayrağın yanlış gelmesi bir sızıntıya
   * dönüşemiyor. Okunamayan değerin nereye düştüğü `precisionOf` içinde
   * (`@/server/api/dto`).
   */
  readonly addressPrecision: AddressPrecision;
  /**
   * `JobStatus`. Başvuru formunun çizilip çizilmeyeceğine bu karar veriyor;
   * okunamayan bir değer `UNKNOWN` olur ve başvuruyu kapatmaz.
   */
  readonly status: JobStatus | "UNKNOWN";
};

/** Başarılı 201 zarfından bu akışın kullandığı tek alan. */
export type JobApplicationReceipt = {
  readonly id: string;
};
