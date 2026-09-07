import type { JobStatus } from "./lifecycle";

export type SalaryType = "HOURLY" | "DAILY" | "UNKNOWN";

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

/** İlan ayrıntısı ekranının backend yanıtından aldığı dar, salt-okunur model. */
export type JobDetail = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly duties: string | null;
  readonly dressCode: string | null;
  readonly categoryName: string | null;
  readonly companyName: string | null;
  readonly employerName: string | null;
  readonly salaryType: SalaryType;
  readonly startsAt: string;
  readonly endsAt: string;
  /** Backend fiyat anlık görüntüsündeki işçi kazancı; istemci yeniden hesaplamaz. */
  readonly workerPayout: string | null;
  readonly currency: string | null;
  readonly insuranceRequired: boolean;
  readonly experienceRequired: boolean;
  /** Backend'in görünürlük kuralından geçmiş `displayAddress` değeri. */
  readonly location: string | null;
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
