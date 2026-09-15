import "server-only";

import { unstable_rethrow } from "next/navigation";

import { gateNotice } from "@/lib/gate-notices";
import type { FormState } from "@/lib/form-state";
import type { GateId } from "@/lib/gates";
import { emptyJobDraft, type JobCategory, type JobDraft } from "@/lib/job-posting";
import { textField } from "@/server/form";

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
