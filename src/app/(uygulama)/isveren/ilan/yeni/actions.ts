"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import { readAddressWrite } from "@/address/write";
import { newIndividualJobPath, publishedJobPath } from "@/lib/app-routes";
import type { FormState } from "@/lib/form-state";
import {
  individualJobBody,
  individualJobErrors,
  moneyPattern,
  withJobFieldAliases,
  type PriceQuoteResult,
} from "@/lib/job-posting";
import { failureState, failureView, validationState } from "@/server/form";
import { createIndividualJob, fetchPriceQuote } from "@/server/jobs/jobs";
import { closedGateState, loadJobCategories, readJobDraft } from "@/server/jobs/submission";
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
    unstable_rethrow(error);
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

  const draft = readJobDraft(formData);
  const address = readAddressWrite(formData);
  const categories = await loadJobCategories();

  const errors = individualJobErrors(draft, categories);
  if (address === null) errors.address = "Adresi onaylaman gerekiyor.";
  if (Object.keys(errors).length > 0) return validationState(errors);

  const body = individualJobBody(draft, address, categories);
  if (body === null) return validationState(errors);

  let created;
  try {
    created = await createIndividualJob(body);
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureState(error);
    return failure.status === "error" && failure.fieldErrors
      ? { ...failure, fieldErrors: withJobFieldAliases(failure.fieldErrors) }
      : failure;
  }

  // Yayımdan sonra kullanıcı ilanın kendi sayfasına düşer: fiyat orada
  // kilitlenmiş hâliyle duruyor ve form durumu geride kalmıyor.
  redirect(created.id ? publishedJobPath(created.id) : newIndividualJobPath);
}
