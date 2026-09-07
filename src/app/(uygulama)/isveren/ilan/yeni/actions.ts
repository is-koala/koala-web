"use server";

import { redirect } from "next/navigation";

import { readAddressWrite } from "@/address/write";
import { newIndividualJobPath, publishedJobPath } from "@/lib/app-routes";
import { gateNotice } from "@/lib/errors";
import type { GateId } from "@/lib/gates";
import type { FormState } from "@/lib/form-state";
import {
  emptyJobDraft,
  individualJobBody,
  individualJobErrors,
  moneyPattern,
  withJobFieldAliases,
  type JobDraft,
  type JobCategory,
  type PriceQuoteResult,
} from "@/lib/job-posting";
import { failureState, failureView, textField, validationState } from "@/server/form";
import { createIndividualJob, fetchJobCategories, fetchPriceQuote } from "@/server/jobs/jobs";
import { currentGates } from "@/server/session/gates";

/**
 * İlan öncesi fiyat dökümü.
 *
 * Üç tutar da backend'den okunuyor ve ekranda **hesaplanmıyor**: hizmet bedeli
 * çalışma zamanı ayarından gelen bir orana bağlı (`CommissionCalculator`) ve
 * yuvarlaması `HALF_UP`. İstemcide çarpıp toplamak, kullanıcıya yayımlarken
 * kilitlenecek olandan başka bir sayı göstermek demekti.
 */
export async function quotePriceAction(workerPayout: string): Promise<PriceQuoteResult> {
  const amount = workerPayout.trim();

  // `@DecimalMin("1.00")`: backend'in de reddedeceği tutar için tur atılmaz.
  if (!moneyPattern.test(amount) || Number(amount) < 1) {
    return { status: "error", errorCode: "JOB_SALARY_MIN_VALUE", httpStatus: 400 };
  }

  try {
    return { status: "ready", breakdown: await fetchPriceQuote(amount) };
  } catch (error) {
    return { status: "error", ...failureView(error) };
  }
}

/**
 * Bireysel ilanı yayımlar.
 *
 * Kapı burada ikinci kez okunuyor. Formdaki devre dışı düğme bir kolaylık;
 * devre dışı bir düğmenin arkasındaki form yine de gönderilebilir ve
 * `JobManager.java:105-114` iki koşulu gövdeye hiç bakmadan arıyor — kullanıcı
 * bunu 403/400 olarak değil, kapının kendi Türkçe metniyle görmeli.
 */
export async function publishIndividualJobAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const { gates } = await currentGates();
  const verdict = gates?.individualJob;
  if (verdict === undefined || !verdict.open) {
    return closedGateState(verdict?.blockedBy ?? []);
  }

  const draft = readDraft(formData);
  const address = readAddressWrite(formData);
  // Katalog okunamazsa sigorta kuralı denetlenemez; yayımı bir referans
  // sorgusuna takmak yerine son sözü backend'e bırakıyoruz — o kuralı
  // gerçekten uyguluyor (`JobManager.java:134-137`).
  const categories = await loadCategories();

  const errors = individualJobErrors(draft, categories);
  if (address === null) errors.address = "Adresi onaylaman gerekiyor.";
  if (Object.keys(errors).length > 0) return validationState(errors);

  const body = individualJobBody(draft, address, categories);
  if (body === null) return validationState(errors);

  let created;
  try {
    created = await createIndividualJob(body);
  } catch (error) {
    const failure = failureState(error);
    return failure.status === "error" && failure.fieldErrors
      ? { ...failure, fieldErrors: withJobFieldAliases(failure.fieldErrors) }
      : failure;
  }

  // Yayımdan sonra kullanıcı ilanın kendi sayfasına düşer: fiyat orada
  // kilitlenmiş hâliyle duruyor ve form durumu geride kalmıyor.
  redirect(created.id ? publishedJobPath(created.id) : newIndividualJobPath);
}

/** Form alanlarının adları DTO alan adlarıyla aynı; taslak birebir okunur. */
function readDraft(formData: FormData): JobDraft {
  return Object.fromEntries(
    Object.keys(emptyJobDraft).map((field) => [field, textField(formData, field)]),
  ) as JobDraft;
}

async function loadCategories(): Promise<readonly JobCategory[] | null> {
  try {
    return await fetchJobCategories();
  } catch {
    return null;
  }
}

/**
 * Kapalı kapının form durumu.
 *
 * Kodu kapının kendi sözlüğünden alıyor (`gateNotice(...).errorCodes`), yani
 * ekrandaki metin backend reddiyle aynı yerden geliyor ve mesaj metnine göre
 * dallanma olmuyor.
 */
function closedGateState(blockedBy: readonly GateId[]): FormState {
  const gate = blockedBy[0];
  const errorCode = (gate === undefined ? undefined : gateNotice(gate).errorCodes[0]) ?? "ACCESS_DENIED";

  return { status: "error", errorCode, httpStatus: 400 };
}
