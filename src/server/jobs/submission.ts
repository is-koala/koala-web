import "server-only";

import { redirect, unstable_rethrow } from "next/navigation";

import { publishedJobPath, publishedJobPathAfterTransportFailure } from "@/lib/app-routes";

import { gateNotice } from "@/lib/gate-notices";
import type { FormState } from "@/lib/form-state";
import type { GateId } from "@/lib/gates";
import {
  emptyJobDraft,
  withTransportFieldPrefix,
  type JobCategory,
  type JobDraft,
} from "@/lib/job-posting";
import { textField } from "@/server/form";
import {
  readTransportPlanWrite,
  writeTransportPlan,
  type TransportPlanRead,
} from "@/server/transport/transport";
import { isEmptyTransportPlan } from "@/transport/plan-form";

import { fetchJobCategories } from "./jobs";

/**
 * İki ilan gönderiminin ortak sunucu adımları.
 *
 * Bireysel ve şirket action'ları ayrı dosyalarda (ayrı rotalar, ayrı kapılar)
 * ama bu üç adımın ikisinde de aynı olması gerekiyor. Kopyalanmış olsalardı
 * biri değişip öbürü olduğu yerde kalabilirdi ve fark ekranda görünmezdi —
 * bu depoda tekrarlayan kusur tam olarak bu.
 */

/** Form alanlarının adları DTO alan adlarıyla aynı; taslak birebir okunur. */
export function readJobDraft(formData: FormData): JobDraft {
  return Object.fromEntries(
    Object.keys(emptyJobDraft).map((field) => [field, textField(formData, field)]),
  ) as JobDraft;
}

/**
 * Kategori kataloğu; okunamazsa `null`.
 *
 * Yayımı bir referans sorgusuna takmak yerine son söz backend'e bırakılıyor —
 * o sigorta kurallarını gerçekten uyguluyor (`JobManager.java:134-137` ve
 * `:201-204`). `null` ile boş liste ayrı: boş liste "kategori yok" demek.
 */
export async function loadJobCategories(): Promise<readonly JobCategory[] | null> {
  try {
    return await fetchJobCategories();
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

/**
 * Kapalı kapının form durumu.
 *
 * Kodu kapının kendi sözlüğünden alıyor (`gateNotice(...).errorCodes`), yani
 * ekrandaki metin backend reddiyle aynı yerden geliyor ve mesaj metnine göre
 * dallanma olmuyor. Kapının backend'de karşılığı yoksa (şirket onayı) liste
 * boş ve nötr koda düşülüyor.
 */
export function closedGateState(blockedBy: readonly GateId[]): FormState {
  const gate = blockedBy[0];
  const errorCode =
    (gate === undefined ? undefined : gateNotice(gate).errorCodes[0]) ?? "ACCESS_DENIED";

  return { status: "error", errorCode, httpStatus: 400 };
}

/**
 * Sihirbazın ulaşım adımı (is-koala/koala-web#187).
 *
 * Boş plan (`NONE`/`NONE`, servis yok) "yok" sayılıyor: her yeni ilana bir
 * ulaşım kaydı yazmak herkese açık sayfada "Ulaşım sağlanmıyor" bölümü
 * çizerdi. Hatalar `transport.` önekiyle dönüyor ki ilan alanlarıyla
 * çakışmasın ve form doğru adıma gitsin.
 */
export function readTransportPlanForPublish(formData: FormData): TransportPlanRead {
  const read = readTransportPlanWrite(formData);
  if (read.status === "ready" && isEmptyTransportPlan(read.draft)) return { status: "absent" };
  if (read.status === "invalid") {
    return { status: "invalid", fieldErrors: withTransportFieldPrefix(read.fieldErrors) };
  }
  return read;
}

/**
 * Yayımın son adımı: ilan yaratıldıktan **sonra** planı yazar ve ilanın
 * sayfasına yönlendirir. Plan ilanın gövdesinde değil, ayrı bir uçta ve ilan
 * kimliği ister. Yazma düşerse ilan zaten yayımda: geri alınmıyor (iptal
 * etmek ilanı öldürür), kullanıcı ilan sayfasına `?ulasim=kaydedilemedi` ile
 * düşüyor; sihirbazın bıraktığı taslağı düzenleyici oradan alıyor.
 *
 * `redirect` istisnayla çalışıyor ve `try` dışında; iki sihirbaz action'ı da
 * kendi `try`'ları bittikten sonra buraya geliyor.
 */
export async function finishJobPublish(
  jobId: string,
  transport: TransportPlanRead,
): Promise<never> {
  const written = await writeTransportPlanAfterPublish(jobId, transport);
  redirect(written ? publishedJobPath(jobId) : publishedJobPathAfterTransportFailure(jobId));
}

/** Yazıldı ya da yazılacak bir şey yoktu → `true`; düştü → `false`. */
async function writeTransportPlanAfterPublish(
  jobId: string,
  transport: TransportPlanRead,
): Promise<boolean> {
  if (transport.status !== "ready") return true;
  try {
    await writeTransportPlan(jobId, transport.body);
    return true;
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}
