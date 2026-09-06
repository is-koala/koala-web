import type { JobStatus } from "./lifecycle";

export type SalaryType = "HOURLY" | "DAILY" | "UNKNOWN";

export type AddressPrecision = "APPROXIMATE" | "EXACT" | "UNKNOWN";

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
