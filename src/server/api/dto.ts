import "server-only";

import type { AddressPrecision, SalaryType } from "@/jobs/contract";
import { employerTypeValues, type JobEmployerType } from "@/jobs/employer-jobs";

/**
 * Backend yanıtlarını ekranın modeline daraltan ortak parçalar.
 *
 * Buradakiler yanıtın **kenarındaki** kararlar: boş dizeyi `null` saymak,
 * tanınmayan bir enum değerini `UNKNOWN`'a düşürmek, ve sayfa zarfının her
 * alanının eksik gelebileceğini kabul etmek. Üçü de her `Dto → model`
 * çeviricisinde tekrar ediliyordu ve tekrarın bedeli görünmez: kopyalardan
 * biri düzeltildiğinde ötekiler eski davranışta kalıyor, ve iki modül aynı
 * backend alanını farklı okuyor.
 *
 * `server-only`, çünkü tarifi edilen şey backend'in tel biçimi; o biçimin
 * istemci grafiğine girmesi için bir sebep yok.
 */

/**
 * `PageDto<T>`.
 *
 * Her alan eksik gelebilir sayılıyor: zarf `null` gövdeyle de dönebiliyor ve
 * eksik bir `totalPages`'i sayı sanmak sayfalama şeridini `NaN` ile çizerdi.
 */
export type PageDto<T> = {
  content?: readonly T[] | null;
  page?: number | null;
  size?: number | null;
  totalElements?: number | null;
  totalPages?: number | null;
  first?: boolean | null;
  last?: boolean | null;
};

/** Yalnız boşluktan ibaret metin bir değer değil; ekran onu `null` gibi ele alır. */
export function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/**
 * Tanınmayan enum değerini `UNKNOWN`'a düşürür.
 *
 * Dönüş tipi `T | "UNKNOWN"` ve bu bir genişletme değil, bir **düzeltme**.
 * Önceki imza `T` döndürdüğünü söyleyip gövdesinde `("UNKNOWN" as T)` yazıyordu:
 * `T` o değeri taşımıyorsa imza yalan söylüyordu ve derleyici bunu göremiyordu.
 * Yalan boş bir ihtimal de değildi — `jobStatuses` gerçek durumların kümesi ve
 * `JobStatus` içinde `"UNKNOWN"` **yok**, yani üç çağrı yeri bugün imzasının
 * dönmeyeceğini söylediği bir değeri alıyordu. Kümeyi genişletmek olmayan bir
 * ilan durumu uydurmak olurdu; doğru olan, yedeğin dönüş tipinde görünmesi.
 *
 * Çağıran taraf bir şey kaybetmiyor: alan zaten `... | "UNKNOWN"` tipli, ve
 * kümesinde `UNKNOWN` bulunanlarda (`SalaryType`, `AddressPrecision`) birleşim
 * aynı tipe sadeleşiyor.
 *
 * Değeri `UNKNOWN`'a düşürmek, onu yok saymaktan ayrı bir karar: ekran
 * "okuyamadım" ile "gelmedi" arasını ayırabiliyor ve okunamayan bir bayrağı
 * güvenli tarafa yuvarlıyor (ADR-0003 adres kesinliğinde bunu yapıyor).
 */
export function known<T extends string>(
  value: string | null | undefined,
  values: ReadonlySet<T>,
): T | "UNKNOWN" {
  return value !== null && value !== undefined && isMember(values, value) ? value : "UNKNOWN";
}

/**
 * Küme üyeliğini bir tip daraltmasına çevirir.
 *
 * `ReadonlySet<T>.has` `T` istiyor, elde ise ham bir `string` var; daraltmayı
 * yapan tek yer burası olsun ki `known` gövdesinde denetlenmemiş bir dönüştürme
 * kalmasın. Buradaki iddia da çalışma zamanında **ölçülüyor**: `has` doğruysa
 * değer gerçekten kümenin bir üyesi.
 */
function isMember<T extends string>(values: ReadonlySet<T>, value: string): value is T {
  return (values as ReadonlySet<string>).has(value);
}

/** `SalaryType`; `UNKNOWN` kümede yok, `known` onu zaten yedek olarak yazıyor. */
export const salaryTypes = new Set<SalaryType>(["HOURLY", "DAILY"]);

export const employerTypes = new Set<JobEmployerType>(employerTypeValues);

export const addressPrecisions = new Set<AddressPrecision>(["APPROXIMATE", "EXACT"]);
