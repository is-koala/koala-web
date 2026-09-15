import type { JobType } from "@/lib/job-posting";

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
  /**
   * `creator.id` — işveren güven kartının (`EmployerStats`) anahtarı.
   *
   * Ekrana çıkmıyor; sayfa onunla `GET /users/{id}/employer-stats` okuyor.
   * Kimliği taşımak bir sızıntı değil: uç `permitAll` ve ilan yanıtı
   * `creator`'ı zaten herkese veriyor.
   */
  readonly employerId: string | null;
  readonly type: JobTypeValue;
  readonly salaryType: SalaryType;
  readonly startsAt: string;
  readonly endsAt: string;
  /** `Instant`; yapısal verinin `datePosted` alanı buradan çıkıyor. */
  readonly createdAt: string | null;
  /**
   * İlan yayımlanırken kilitlenen fiyat anlık görüntüsü (ADR-0002).
   *
   * Snapshot'ı olmayan ilanda `null`; `salary` alanından yeniden üretmek
   * kilitlenmiş tutarla ayrışabilirdi. Ücret alanlarının bakan kişiye göre
   * neden düştüğü `JobPricing` üzerinde.
   */
  readonly pricing: JobPricing | null;
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
   * `JobStatus`; kullanıcıya gösterilecek kapanma nedenini ayrıştırır.
   * Başvurunun gerçekten açık olup olmadığını `acceptingApplications` verir.
   */
  readonly status: JobStatus | "UNKNOWN";
  /** Backend'in durum ve bitiş anını birlikte değerlendirerek verdiği başvuru kapısı. */
  readonly acceptingApplications: boolean;
};

/**
 * İlanın kilitlenen fiyat anlık görüntüsü — `PricingBreakdownDto`'nun
 * **bakan kişiye göre** okunan hâli.
 *
 * Backend herkese açık ve işçi görünümünde yalnız `workerPayout`, `currency`
 * ve `pricingVersion` gönderiyor; `serviceFeeRate`, `serviceFeeAmount` ve
 * `employerTotal` **null** (is-koala/koala-backend#304, is-koala/koala-web#181).
 * Sahibi ve şirket yetkilisi tam dökümü alıyor. Bu yüzden tip, teklif ve
 * ödeme akışlarının tam `PricingBreakdown`'ından (`@/lib/job-posting`) ayrı:
 * orada eksik bir ücret alanı bozuk bir yanıt, burada bir görünüm.
 *
 * Hizmet bedeli ile işveren toplamı birlikte ya var ya yok (`toPricing`,
 * `@/server/jobs/job-detail-dto`): yarım bir döküm, çalışanın alacağı ile
 * işverenin ödeyeceği tutarın hangisi olduğunu belirsiz bırakırdı. Bütün
 * tutarlar dize; nedeni `PricingBreakdown` üzerinde.
 */
export type JobPricing = {
  readonly pricingVersion: string;
  readonly currency: string;
  readonly workerPayout: string;
  readonly serviceFeeRate: string | null;
  readonly serviceFeeAmount: string | null;
  readonly employerTotal: string | null;
};

/** Başarılı 201 zarfından bu akışın kullandığı tek alan. */
export type JobApplicationReceipt = {
  readonly id: string;
};

/**
 * `EmployerStatsDto` — ilan sayfasındaki işveren güven kartı.
 *
 * `averageRating` dize: backend `BigDecimal` gönderiyor ve değerlendirme yoksa
 * `0` dönüyor (`UsersController.employerStats`); kart `reviewCount` sıfırken
 * puanı hiç yazmıyor ki "0,0 puan" kötü bir işveren gibi okunmasın.
 */
export type EmployerStats = {
  readonly jobsPosted: number;
  readonly completedJobs: number;
  readonly averageRating: string | null;
  readonly reviewCount: number;
  /** `Instant`; kart yalnız ay ve yılı yazıyor. */
  readonly memberSince: string | null;
};
